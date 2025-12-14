#!/bin/sh 
TAG=${TAG:-dev}
SCHEDULER_OUTPUT="infra/k8s/schedulers.yml"
SCHEDULER_PATH="servers/cron/src/schedulers"
HASH=$(sudo kubectl get secret rhiva-secrets -n rhiva-ag -o yaml | sha256sum | awk '{print $1}')

touch "$SCHEDULER_OUTPUT"
> "$SCHEDULER_OUTPUT"

for FILE in $SCHEDULER_PATH/*; do
  BASENAME=$(basename "$FILE")
  NAME="${BASENAME%%.scheduler.*}-scheduler"
  
  cat >> "$SCHEDULER_OUTPUT" <<EOF
apiVersion: apps/v1
kind: Deployment 
metadata:
  name: $NAME-deployment
  namespace: rhiva-ag
  labels:
    app: $NAME
    role: scheduler
spec:
  replicas: 1
  selector: 
    matchLabels:
      app: $NAME
  template:
    metadata:
      labels: 
        app: $NAME
      annotations:
        configmap-hash: $HASH
    spec:
      imagePullSecrets:
        - name: regcred
      containers:
        - name: scheduler
          image: $REGISTRY_URL/rhiva-ag/servers:$TAG
          command: ["bun"]
          args: ["$FILE"]
          envFrom:
            - secretRef:
                name: rhiva-secrets
            - secretRef: 
                name: aws-credentials
          resources:
            requests:
              cpu: "0.25"
              memory: "512Mi"
            limits:
              cpu: "0.5"
              memory: "1Gi"
---
EOF
done


WORKER_OUTPUT="infra/k8s/workers.yml"
WORKER_PATH="servers/cron/src/workers"
> "$WORKER_OUTPUT"

for FILE in $WORKER_PATH/*; do
  BASENAME=$(basename "$FILE")
  NAME="${BASENAME%%.worker.*}-worker"
  
  cat >> "$WORKER_OUTPUT" <<EOF
apiVersion: apps/v1
kind: Deployment 
metadata:
  name: $NAME-deployment
  namespace: rhiva-ag
  labels:
    app: $NAME
    role: worker
spec:
  replicas: 2
  selector: 
    matchLabels:
      app: $NAME
  template:
    metadata:
      labels: 
        app: $NAME
      annotations:
        configmap-hash: $HASH
    spec:
      imagePullSecrets:
        - name: regcred    
      containers:
        - name: worker
          image: $REGISTRY_URL/rhiva-ag/servers:$TAG
          command: ["bun"]
          args: ["$FILE"]
          envFrom:
            - secretRef:
                name: rhiva-secrets
            - secretRef: 
                name: aws-credentials
          resources:
            requests:
              cpu: "0.25"
              memory: "256Mi"
            limits:
              cpu: "1"
              memory: "512Mi"
---
EOF

  cat >> "$WORKER_OUTPUT" <<EOF
apiVersion: autoscaling/v2 
kind: HorizontalPodAutoscaler 
metadata:
  name: $NAME-hpa 
  namespace: rhiva-ag
spec:
  scaleTargetRef:
    apiVersion: apps/v1 
    kind: Deployment 
    name: $NAME-deployment 
  minReplicas: 2
  maxReplicas: 20
  metrics:
    - type: Resource 
      resource: 
        name: cpu 
        target:
          type: Utilization
          averageUtilization: 70
---
EOF
done

TRPC_SERVER_OUTPUT="infra/k8s/trpc.yml"

cat > "$TRPC_SERVER_OUTPUT" << EOF
apiVersion: apps/v1
kind: Deployment 
metadata:
  name: trpc-deployment
  namespace: rhiva-ag
  labels:
    app: trpc
spec:
  replicas: 2
  selector: 
    matchLabels:
      app: trpc
  template:
    metadata:
      labels: 
        app: trpc
      annotations:
        configmap-hash: $HASH
    spec:
      imagePullSecrets:
        - name: regcred
      containers:  
        - name: trpc 
          image: $REGISTRY_URL/rhiva-ag/servers:latest
          command: ["bun"]
          args: ["servers/trpc/src/index.ts"]
          envFrom:
            - secretRef:
                name: rhiva-secrets   
            - secretRef: 
                name: aws-credentials
          ports: 
            - containerPort: 8000
---
apiVersion: v1
kind: Service 
metadata:
  name: trpc-service
  namespace: rhiva-ag
spec: 
  type: ClusterIP
  selector: 
    app: trpc 
  ports: 
  - port: 80
    targetPort: 8000 
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler 
metadata:
  name: trpc-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment 
    name: trpc-deployment
  minReplicas: 2
  maxReplicas: 20
  metrics:
    - type: Resource
      resource: 
        name: cpu 
        target: 
          type: Utilization
          averageUtilization: 70
---
apiVersion: networking.k8s.io/v1
kind: Ingress 
metadata:
  name: trpc-ingress 
  namespace: rhiva-ag
  metadata:
    annotations:
      cert-manager.io/cluster-issuer: letsencrypt
spec:
  ingressClassName: caddy
  tls: 
    - secretName: trpc-tls 
      hosts:
        - v1.api.rhiva.fun 
  rules:
    - host: v1.api.rhiva.fun 
      http:
       paths:
         - path: /
           pathType: Prefix
           backend: 
             service:
               name: trpc-service
               port:
                 number: 80
---
EOF

MCP_SERVER_OUTPUT="infra/k8s/mcp.yml"
cat > "$MCP_SERVER_OUTPUT" << EOF
apiVersion: apps/v1
kind: Deployment 
metadata:
  name: mcp-deployment
  namespace: rhiva-ag
  labels:
    app: mcp
spec:
  replicas: 2
  selector: 
    matchLabels:
      app: mcp
  template:
    metadata:
      labels: 
        app: mcp
      annotations:
        configmap-hash: $HASH
    spec:
      imagePullSecrets:
        - name: regcred
      containers:
        - name: mcp
          image: $REGISTRY_URL/rhiva-ag/servers:$TAG
          command: ["bun"]
          args: ["servers/mcp/src/index.ts"]
          envFrom:
            - secretRef:
                name: rhiva-secrets   
            - secretRef: 
                name: aws-credentials
          ports: 
            - containerPort: 8000
          resources:
            requests:
              cpu: "250m"
              memory: "512Mi"
---
apiVersion: v1
kind: Service 
metadata:
  name: mcp-service
  namespace: rhiva-ag
spec: 
  type: ClusterIP
  selector: 
    app: mcp 
  ports: 
  - port: 80
    targetPort: 8000 
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler 
metadata:
  name: mcp-hpa
  namespace: rhiva-ag
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment 
    name: mcp-deployment
  minReplicas: 2
  maxReplicas: 20
  metrics:
    - type: Resource
      resource: 
        name: cpu 
        target: 
          type: Utilization
          averageUtilization: 70
EOF
