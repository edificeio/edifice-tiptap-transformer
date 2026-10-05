#!/usr/bin/env groovy

pipeline {
  agent any
    stages {
      stage("Initialization") {
        steps {
          script {
            def version = sh(returnStdout: true, script: 'cat package.json | grep version  | head -1 | awk -F: \'{ print $2 }\' | sed \'s/[",]//g\'')
            buildName "${env.GIT_BRANCH.replace("origin/", "")}@${version}"
          }
        }
      }
        stage('Unit & integration tests') {
            steps {
                // Runs via the shared opendigitaleducation/node:18-alpine-pnpm CI image
                // (docker-compose.yml's "node" service) — no app Dockerfile involved.
                sh 'docker compose run --rm node sh -c "pnpm i --frozen-lockfile && pnpm test"'
            }
        }
        stage('End-to-end tests (running container)') {
            steps {
                // Builds and starts the real production image, then runs the
                // regression/smoke suite against it over the docker-compose network.
                sh './scripts/run-integration-docker-tests.sh'
            }
        }
        stage('Deploy image') {
            steps {
                sh './scripts/build-image.sh'
            }
        }
    }
    post {
        always {
            sh 'docker compose down -v || true'
        }
    }
}
