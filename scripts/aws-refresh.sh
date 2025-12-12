#!/bin/bash
set -e
# inherit env from caller function 

NAMESPACE="rhiva-ag"
SECRET_NAME="aws-credentials"

kubectl create secret generic "$SECRET_NAME" \
  --namespace="$NAMESPACE" \
  --from-literal=AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID" \
  --from-literal=AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY" \
  --from-literal=AWS_SESSION_TOKEN="$AWS_SESSION_TOKEN" \
  --dry-run=client -o yaml | kubectl apply -f - >/dev/null 2>&1

# search for all that reference aws-credentials 
KINDS=(deployment statefulset daemonset)

for KIND in $KINDS; do 
  WORKLOADS=$(
    kubectl get $KIND -n "$NAMESPACE" -o json | \
    jq -r --arg SECRET "$SECRET_NAME" \
    '.items[]
    | select(.spec.template.spec | tostring | contains($SECRET))
    | .metadata.name'
  )
  
  for NAME in $WORKLOADS; do 
    kubectl rollout restart "$KIND/$NAME" -n "$NAMESPACE"
  done
done