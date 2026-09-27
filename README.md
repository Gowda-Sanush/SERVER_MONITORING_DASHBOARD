# Server Monitoring Dashboard

A lightweight server monitoring application that presents infrastructure health and resource utilization in a browser dashboard. The current version is a static frontend packaged with Nginx and prepared for deployment to Kubernetes.

## Project Status

Implemented in this project:

- Responsive server monitoring dashboard
- Summary counts for total, healthy, warning, and offline servers
- Per-server CPU, memory, disk, and uptime metrics
- CPU line charts, memory bar charts, and disk doughnut charts using Chart.js
- Live simulated metric updates every five seconds
- Status thresholds that classify servers as online, warning, or offline
- Docker image based on Nginx Alpine
- Kubernetes Deployment, Service, Ingress, and ECR image-pull Secret configuration

The application currently reads its initial server data from a local JSON file. The live updates are simulated in the browser; there is no backend metrics collector or persistent monitoring database in the repository yet.

## Application Overview

The dashboard loads four sample servers from `data/servers.json`:

| Server | Initial status | CPU | Memory | Disk | Uptime |
| --- | --- | ---: | ---: | ---: | --- |
| web-01 | Online | 42% | 58% | 34% | 14d 7h |
| web-02 | Online | 67% | 72% | 41% | 8d 12h |
| api-01 | Online | 31% | 44% | 29% | 21d 3h |
| db-01 | Warning | 81% | 89% | 76% | 32d 1h |

The frontend fetches the JSON data, renders one card per server, and refreshes the displayed values every five seconds. Each server card contains:

- Current status badge
- CPU, memory, disk, and uptime values
- CPU utilization trend
- Memory utilization history
- Disk used/free chart

### Status Logic

- **Online:** normal utilization
- **Warning:** CPU above 80%, memory above 85%, or disk above 80%
- **Offline:** CPU above 90%, memory above 92%, or disk above 92%

These classifications are currently based on simulated browser values and should be replaced with real health checks or metrics from a monitoring service for production use.

## Architecture

```text
Browser: http://<ALB-DNS>/app/
                 |
                 v
Internet-facing AWS Application Load Balancer
AWS Load Balancer Controller; IP targets
                 |
                 | Ingress path / -> Service port 8080
                 v
Service: infra-monitor-dash-service
                 |
                 | Pod target port 80
                 v
Deployment: infra-monitor-dash
                 |
                 v
Nginx container
  /app/ serves dashboard; /data/ serves servers.json

Image source: ECR -> ECR image-pull Secret -> Kubernetes pod
```

## Repository Structure

```text
server-monitoring-dashboard/
├── data/
│   └── servers.json          Sample server metrics
├── frontend/
│   ├── index.html             Dashboard markup
│   ├── script.js              Data loading, status logic, and charts
│   └── styles.css             Dashboard styling and responsive layout
├── k8/\
│   ├── deployment.yml         Kubernetes pod and ECR image configuration
│   ├── ingress.yml             AWS ALB Ingress routing
│   ├── secret.yml              Kubernetes Docker registry Secret template
│   └── service.yml             Internal service on port 8080
├── default.conf                Nginx routes for the app and data
├── Dockerfile                  Nginx-based container image definition
└── README.md                   Project documentation
```

## Tools and Technologies

### Application Tools

- HTML5 for the dashboard structure
- CSS3 for layout, responsive behavior, status colors, and visual styling
- Vanilla JavaScript for application behavior
- Chart.js, loaded from jsDelivr, for CPU, memory, and disk charts
- JSON for sample server data

### Container and Deployment Tools

- Docker for packaging the frontend and data files
- Nginx Alpine as the web server inside the container
- Kubernetes for deployment and service orchestration
- AWS Load Balancer Controller and Application Load Balancer for HTTP routing
- Amazon Elastic Container Registry (ECR) for storing and pulling the Docker image
- AWS CLI for generating the ECR authentication password
- `kubectl` for creating the registry Secret and applying Kubernetes manifests

## Docker and Nginx Configuration

The `Dockerfile`:

1. Starts from `nginx:alpine`.
2. Copies `frontend/` to `/usr/share/nginx/html/app`.
3. Copies `data/` to `/usr/share/nginx/html/data`.
4. Installs the custom Nginx configuration.
5. Exposes port 80.

The Nginx configuration redirects the root path to `/app/`, serves the dashboard from `/app/`, and serves the JSON data from `/data/`. The dashboard requests `../data/servers.json`, which resolves to the data route when the app is opened under `/app/`.

## Kubernetes Configuration

### Deployment

`k8/deployment.yml` creates one replica named `infra-monitor-dash`. The pod:

- Uses the image `355718663378.dkr.ecr.ap-south-1.amazonaws.com/infra-monitoring/dashboard:latest`
- Pulls the image from the AWS Mumbai region (`ap-south-1`)
- Exposes container port 80
- Uses `imagePullPolicy: Always`
- References the `ecr-registry-secret` image pull Secret

### Service

`k8/service.yml` exposes the deployment internally on port 8080 and forwards traffic to container port 80.

### Ingress

`k8/ingress.yml` configures an internet-facing AWS Application Load Balancer through the AWS Load Balancer Controller. It uses the `alb` Ingress class and IP targets, and routes requests matching `/` to `infra-monitor-dash-service` on port 8080. The Service forwards traffic to the application pod on port 80. Nginx redirects `/` to `/app/`, where the dashboard is served.

The AWS Load Balancer Controller must be installed in the cluster and configured with the required AWS IAM permissions; the Ingress manifest does not install or configure the controller. After the controller provisions the ALB, retrieve its DNS name with:

```powershell
kubectl get ingress infra-monitor-dash-ingress -n infra-monitoring
```

Open the dashboard at `http://<ADDRESS>/app/`, replacing `<ADDRESS>` with the Ingress address shown by `kubectl`. This manifest does not configure a hostname or TLS.

### ECR Secret

`k8/secret.yml` is a template for a Kubernetes `dockerconfigjson` Secret. The value is intentionally represented as a placeholder and must be generated for the target AWS account and cluster.

Example command from the project configuration:

```powershell
aws ecr get-login-password --region ap-south-1 | kubectl create secret docker-registry ecr-registry-secret `
  --docker-server=355718663378.dkr.ecr.ap-south-1.amazonaws.com `
  --docker-username=AWS `
  --docker-password-stdin
```

## Running Locally

Because the frontend fetches `data/servers.json`, serve the project through a local HTTP server instead of opening `index.html` directly.

### Using Docker

From the project directory:

```powershell
docker build -t server-monitoring-dashboard .
docker run --rm -p 8080:80 server-monitoring-dashboard
```

Open:

```text
http://localhost:8080/app/
```

### Using a Simple Static Server

From the project directory, use any static web server that serves both `frontend/` and `data/`. For example, with Python:

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000/frontend/`. The relative data request will resolve to the repository's `data/` directory when the server exposes the project root.

## AWS Services Explored

The repository directly reflects the use of **Amazon ECR** for container image storage and **AWS Application Load Balancer** for inbound HTTP traffic. The deployment also reflects a broader AWS container workflow:

- Build the application into a Docker image.
- Tag the image for the ECR repository.
- Authenticate Docker or Kubernetes to ECR using the AWS CLI.
- Push the image to ECR.
- Configure Kubernetes to pull the image with an image-pull Secret.
- Route external HTTP traffic through an ALB managed by the AWS Load Balancer Controller.

Amazon EKS hosts the Kubernetes workloads. The repository contains an ALB Ingress resource, but the AWS Load Balancer Controller and its IAM permissions must be installed/configured separately; the application manifests do not provision them. Amazon CloudWatch can be added for logs and metrics.

## Production Considerations

- Replace simulated metrics with a real collection API or monitoring agent.
- Store time-series data in a monitoring backend rather than a static JSON file.
- Use immutable image tags instead of `latest`.
- Store ECR credentials through a managed identity or workload identity where available.
- Add readiness and liveness probes to the Deployment.
- Add CPU and memory resource requests and limits.
- Restrict or remove public directory listing for `/data/`.
- Pin the Chart.js dependency instead of relying on an unpinned CDN URL.
- Add TLS, authentication, authorization, and alerting before exposing the dashboard publicly.
- Add automated tests and a CI/CD pipeline for image builds and Kubernetes deployments.

## Files Included

This README summarizes the current contents of the application and its deployment configuration as of August 2026.
