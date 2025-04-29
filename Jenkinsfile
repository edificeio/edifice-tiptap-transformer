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
        stage('Deploy image') {
            steps {
                sh './scripts/build-image.sh'
            }
        }
    }
}
