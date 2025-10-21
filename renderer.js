const agents = [
  { name: 'Alice', status: 'Available' },
  { name: 'Bob', status: 'Busy' },
  { name: 'Carol', status: 'Break' }
];

// render UI
function renderAgents() {
  const list = document.getElementById('agent-list');
  list.innerHTML = agents.map(a => `
    <tr>
      <td>${a.name}</td>
      <td>
        <select onchange="changeStatus('${a.name}', this.value)">
          <option ${a.status === 'Available' ? 'selected' : ''}>Available</option>
          <option ${a.status === 'Busy' ? 'selected' : ''}>Busy</option>
          <option ${a.status === 'Break' ? 'selected' : ''}>Break</option>
        </select>
      </td>
    </tr>
  `).join('');
}

function changeStatus(name, newStatus) {
  const agent = agents.find(a => a.name === name);
  if (agent) {
    agent.status = newStatus;
    window.nativeAPI.notifyAgentEvent(name, 'status_change', { newStatus });
  }
  renderAgents();
}

function exportCSV() {
  const csv = agents.map(a => `${a.name},${a.status}`).join('\n');
  window.nativeAPI.saveFile(csv, 'agents.csv');
}

renderAgents();