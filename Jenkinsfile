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
                // Runs inside the "test" Docker target (clean Node 18 env with full
                // devDependencies) so the Jenkins agent only needs Docker installed.
                sh 'docker compose run --rm --build tests'
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
