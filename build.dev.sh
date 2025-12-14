#!/bin/bash
set -e

ENV_FILE=".env"
if [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

NAMESPACE="rhiva-ag"

AWS_REFRESH_FILE="$HOME/vps-infra/aws-refresh.sh"
AWS_REFRESH_SCRIPT=". $HOME/rhiva-ag/scripts/aws-refresh.sh"
if [ -f "$AWS_REFRESH_FILE" ]; then
  if ! grep -qF -- "$AWS_REFRESH_SCRIPT" "$AWS_REFRESH_FILE"; then 
    echo "$AWS_REFRESH_SCRIPT" >> "$AWS_REFRESH_FILE"
  fi
fi 

if ! kubectl get namespace rhiva-ag >/dev/null 2>&1; then
  sudo kubectl create namespace $NAMESPACE
fi

sudo kubectl create secret generic rhiva-secrets \
  --from-env-file=.env \
  --namespace $NAMESPACE \
  --dry-run=client -o yaml | kubectl apply -f -

export TAG="latest"
export BUILD_TS=$(date +%s)
export REGISTRY_URL="registry.rhiva.fun"

sudo docker build --build-arg GITHUB_TOKEN=$GITHUB_TOKEN -t $REGISTRY_URL/rhiva-ag/servers:$TAG -f servers/Dockerfile .
sudo docker push $REGISTRY_URL/rhiva-ag/servers:$TAG

kubectl create secret generic regcred \
--from-file=.dockerconfigjson=$HOME/.docker/config.json \
--namespace $NAMESPACE \
--type=kubernetes.io/dockerconfigjson -o yaml | kubectl apply -f - 

. ./scripts/k8s-codegen.sh 
sudo kubectl apply -f infra/k8s