const serverList = document.getElementById('server-list');
const lastUpdatedEl = document.getElementById('last-updated');
const totalServersEl = document.getElementById('total-servers');
const healthyServersEl = document.getElementById('healthy-servers');
const warningServersEl = document.getElementById('warning-servers');
const offlineServersEl = document.getElementById('offline-servers');

let serverState = [];
let chartInstances = [];

function clampValue(value, min = 0, max = 100) {
  return Math.min(Math.max(value, min), max);
}

function buildTrendValues(baseValue, offset = 8) {
  const values = [];
  for (let i = 0; i < 6; i += 1) {
    const swing = Math.round(Math.sin((i + 1) * 1.4) * offset);
    values.push(Math.max(10, Math.min(100, baseValue + swing - (offset * 1.4) + i * 3)));
  }
  return values;
}

function buildMemoryValues(baseValue) {
  const values = [];
  for (let i = 0; i < 5; i += 1) {
    const spread = Math.round(Math.cos((i + 1) * 1.3) * 7);
    values.push(Math.max(15, Math.min(100, baseValue + spread - 8 + i * 2)));
  }
  return values;
}

function buildDiskChartData(server) {
  return {
    labels: ['Used', 'Free'],
    datasets: [
      {
        data: [server.disk, 100 - server.disk],
        backgroundColor: ['#38bdf8', '#1e293b'],
        borderWidth: 0,
        hoverOffset: 8,
      },
    ],
  };
}

function updateSummary() {
  const total = serverState.length;
  const healthy = serverState.filter((server) => server.status === 'online').length;
  const warning = serverState.filter((server) => server.status === 'warning').length;
  const offline = serverState.filter((server) => server.status === 'offline').length;

  totalServersEl.textContent = total;
  healthyServersEl.textContent = healthy;
  warningServersEl.textContent = warning;
  offlineServersEl.textContent = offline;

  const now = new Date();
  lastUpdatedEl.textContent = `Last updated: ${now.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })}`;
}

function updateLiveMetrics() {
  if (!serverState.length) return;

  serverState = serverState.map((server) => {
    const nextCpu = clampValue(server.cpu + Math.floor(Math.random() * 11) - 5, 10, 95);
    const nextMemory = clampValue(server.memory + Math.floor(Math.random() * 13) - 6, 15, 98);
    const nextDisk = clampValue(server.disk + Math.floor(Math.random() * 9) - 4, 10, 97);

    let nextStatus = 'online';
    if (nextCpu > 80 || nextMemory > 85 || nextDisk > 80) {
      nextStatus = 'warning';
    }
    if (nextCpu > 90 || nextMemory > 92 || nextDisk > 92) {
      nextStatus = 'offline';
    }

    return {
      ...server,
      cpu: nextCpu,
      memory: nextMemory,
      disk: nextDisk,
      status: nextStatus,
    };
  });

  renderServers(serverState);
  initCharts();
  updateSummary();
}

async function loadServers() {
  try {
    const response = await fetch('../data/servers.json');

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const servers = await response.json();
    serverState = servers;
    renderServers(serverState);
    initCharts();
    updateSummary();
    setInterval(updateLiveMetrics, 5000);
  } catch (error) {
    serverList.innerHTML = `
      <div class="error">
        Unable to load server data. Make sure the app is being served from the project root.
      </div>
    `;
    console.error('Failed to load server data:', error);
  }
}

function initCharts() {
  chartInstances.forEach((chart) => chart.destroy());
  chartInstances = [];

  document.querySelectorAll('.chart').forEach((canvas) => {
    const type = canvas.dataset.type;
    const cpuValues = JSON.parse(canvas.dataset.cpuValues || '[]');
    const memoryValues = JSON.parse(canvas.dataset.memoryValues || '[]');
    const diskValues = JSON.parse(canvas.dataset.diskValues || '[]');

    const baseConfig = {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 900, easing: 'easeOutQuart' },
      plugins: { legend: { display: false } },
      scales: type === 'line' ? { y: { beginAtZero: false, min: 0, max: 100, grid: { color: 'rgba(148,163,184,0.12)' }, ticks: { color: '#cbd5e1', callback: (value) => `${value}%` } }, x: { grid: { display: false }, ticks: { color: '#cbd5e1' } } } : { y: { beginAtZero: false, min: 0, max: 100, display: false }, x: { display: false } },
    };

    if (type === 'line') {
      chartInstances.push(
        new Chart(canvas, {
          type: 'line',
          data: {
            labels: ['00m', '05m', '10m', '15m', '20m', '25m'],
            datasets: [
              {
                label: 'CPU',
                data: cpuValues,
                borderColor: '#38bdf8',
                backgroundColor: 'rgba(56, 189, 248, 0.2)',
                pointBackgroundColor: '#e0f2fe',
                pointBorderColor: '#38bdf8',
                pointRadius: 3,
                borderWidth: 2.5,
                fill: true,
                tension: 0.35,
              },
            ],
          },
          options: baseConfig,
        })
      );
    }

    if (type === 'bar') {
      chartInstances.push(
        new Chart(canvas, {
          type: 'bar',
          data: {
            labels: ['T1', 'T2', 'T3', 'T4', 'T5'],
            datasets: [
              {
                data: memoryValues,
                backgroundColor: ['#a78bfa', '#8b5cf6', '#7c3aed', '#6d28d9', '#5b21b6'],
                borderRadius: 8,
                borderSkipped: false,
              },
            ],
          },
          options: baseConfig,
        })
      );
    }

    if (type === 'doughnut') {
      chartInstances.push(
        new Chart(canvas, {
          type: 'doughnut',
          data: {
            labels: ['Used', 'Free'],
            datasets: [
              {
                data: diskValues,
                backgroundColor: ['#fbbf24', '#1e293b'],
                borderWidth: 0,
                hoverOffset: 12,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '62%',
            plugins: { legend: { position: 'bottom', labels: { color: '#cbd5e1', usePointStyle: true, pointStyle: 'circle' } } },
          },
        })
      );
    }
  });
}

function renderServers(servers) {
  if (!Array.isArray(servers) || servers.length === 0) {
    serverList.innerHTML = '<div class="error">No server data available.</div>';
    return;
  }

  serverList.innerHTML = servers
    .map((server) => {
      const cpuValues = buildTrendValues(server.cpu, 12);
      const memoryValues = buildMemoryValues(server.memory);
      const diskValues = [server.disk, 100 - server.disk];

      const statusLabel = server.status === 'offline' ? 'offline' : server.status === 'warning' ? 'warning' : 'online';

      return `
        <article class="server-card ${statusLabel}">
          <div class="card-header">
            <div class="server-name-wrap">
              <span class="server-dot ${statusLabel}"></span>
              <h2>${server.name}</h2>
            </div>
            <span class="status-badge ${statusLabel}">${statusLabel}</span>
          </div>

          <div class="metrics">
            <div class="metric">
              <span>CPU</span>
              <strong>${server.cpu}%</strong>
            </div>
            <div class="metric">
              <span>Memory</span>
              <strong>${server.memory}%</strong>
            </div>
            <div class="metric">
              <span>Disk</span>
              <strong>${server.disk}%</strong>
            </div>
            <div class="metric">
              <span>Uptime</span>
              <strong>${server.uptime}</strong>
            </div>
          </div>

          <div class="chart-stack">
            <div class="chart-panel">
              <div class="chart-header">
                <span>CPU Utilization</span>
                <strong>${server.cpu}%</strong>
              </div>
              <div class="chart-box">
                <canvas class="chart" data-type="line" data-cpu-values='${JSON.stringify(cpuValues)}'></canvas>
              </div>
            </div>

            <div class="chart-panel">
              <div class="chart-header">
                <span>Memory Utilization</span>
                <strong>${server.memory}%</strong>
              </div>
              <div class="chart-box small-box">
                <canvas class="chart" data-type="bar" data-memory-values='${JSON.stringify(memoryValues)}'></canvas>
              </div>
            </div>

            <div class="chart-panel">
              <div class="chart-header">
                <span>Disk Utilization</span>
                <strong>${server.disk}%</strong>
              </div>
              <div class="chart-box donut-box">
                <canvas class="chart" data-type="doughnut" data-disk-values='${JSON.stringify(diskValues)}'></canvas>
              </div>
            </div>
          </div>

          <div class="uptime">Status overview for ${server.name}</div>
        </article>
      `;
    })
    .join('');
}

loadServers();
