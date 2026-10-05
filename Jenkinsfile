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
                // -u: the image's default "node" user can't write to the
                // bind-mounted workspace otherwise (EACCES on the Jenkins host).
                // npm i -g --prefix: pins pnpm to our own version, isolated from
                // the image's root-owned global pnpm (too new for our lockfile).
                // Called by full path, not via $PATH: this command is double-quoted,
                // so a "$PATH" reference here gets expanded by the JENKINS HOST
                // shell (missing /bin) before docker even starts, not by the
                // container - that's what caused the original silent ENOENT.
                sh 'docker compose run --rm -u $(id -u):$(id -g) node sh -c "npm i -g pnpm@8.6.6 --prefix /tmp/pnpm-local --silent && /tmp/pnpm-local/bin/pnpm i --frozen-lockfile && /tmp/pnpm-local/bin/pnpm test"'
            }
        }
        stage('End-to-end tests') {
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
