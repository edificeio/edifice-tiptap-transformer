#!/usr/bin/env bash
set -e
FULL_PATH_TO_SCRIPT="$(realpath "$0")"
SCRIPT_DIRECTORY="$(dirname "$FULL_PATH_TO_SCRIPT")"
PROJECT_BASE="$(realpath "$SCRIPT_DIRECTORY/..")"
cd $PROJECT_BASE
PACKAGE_VERSION=$(cat package.json \
  | grep version \
  | head -1 \
  | awk -F: '{ print $2 }' \
  | sed 's/[",]//g')
PACKAGE_VERSION=$(echo $PACKAGE_VERSION | sed -e 's/ //g')
TAG="edifice-tiptap-transformer:$PACKAGE_VERSION"
ARCHITECTURE="linux/arm/v7,linux/arm/v8,linux/arm64,linux/amd64"
REPOSITORY="maven.opendigitaleducation.com/docker/repository/sre-docker-hosted"
docker buildx build --push -t "$REPOSITORY/$TAG" . --platform "$ARCHITECTURE"