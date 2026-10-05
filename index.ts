import dotenv from "dotenv";
import express from "express";
import cluster from "cluster";
import os from "os";
import createServer from "./src/server.js";
import { logger } from "./src/logger.js";
import { AggregatorRegistry } from "prom-client";
import fs from 'fs';

createPidFile();

dotenv.config();

const metricsServer = express();
const aggregatorRegistry = new AggregatorRegistry();

const numCPUs = os.cpus().length;
const desiredInstances = process.env.NB_THREADS
  ? parseInt(process.env.NB_THREADS)
  : numCPUs;
const metricsPort = process.env.METRICS_PORT || 3001;

if (cluster.isPrimary && desiredInstances > 1) {
  logger.info({ desiredInstances }, "Launching instances of the transformer");
  // Fork workers for each CPU core
  for (let i = 0; i < desiredInstances; i++) {
    cluster.fork();
  }
  cluster.on("exit", (worker: any, code: number, signal: any) => {
    logger.error({ pid: worker.process.pid, code, signal }, "Worker died");
  });

  metricsServer.get("/metrics", async (req, res) => {
    try {
      const metrics = await aggregatorRegistry.clusterMetrics();
      res.set("Content-Type", aggregatorRegistry.contentType);
      res.send(metrics);
    } catch (e) {
      logger.error({ err: e }, "metrics.not.available");
      res.statusCode = 500;
      res.send("metrics.not.available");
    }
  });
  metricsServer.listen(metricsPort);
  logger.info(
    { metricsPort },
    "Cluster metrics server listening, metrics exposed on /metrics"
  );
} else {
  createServer();
}
function createPidFile() {
  const path = process.env.PID_FILE;
  if(path) {
    if(fs.existsSync(path)) {
      logger.info({ path }, "Deleting old pid file");
      fs.unlinkSync(path);
    }
    logger.info({ path }, "Writing pid file");
    // Write PID file
    fs.writeFileSync(path, process.pid.toString(), { flag: 'w' });

    process.on('exit', () => {
      // Remove PID file on exit
      logger.info({ path }, "Removing pid file after exit");
      fs.unlinkSync(path);
    });
  }
}

