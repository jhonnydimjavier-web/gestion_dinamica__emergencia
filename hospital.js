(() => {
  'use strict';

  // Heap binario manual. Un número menor representa una prioridad clínica mayor.
  class MinHeap {
    constructor() { this.items = []; }
    get size() { return this.items.length; }
    before(a, b) {
      return a.priority < b.priority ||
        (a.priority === b.priority && (a.arrival < b.arrival ||
          (a.arrival === b.arrival && a.sequence < b.sequence)));
    }
    push(value) {
      this.items.push(value);
      let index = this.items.length - 1;
      while (index > 0) {
        const parent = Math.floor((index - 1) / 2);
        if (!this.before(this.items[index], this.items[parent])) break;
        [this.items[index], this.items[parent]] = [this.items[parent], this.items[index]];
        index = parent;
      }
    }
    pop() {
      if (!this.items.length) return null;
      const first = this.items[0];
      const last = this.items.pop();
      if (this.items.length) {
        this.items[0] = last;
        let index = 0;
        while (true) {
          const left = index * 2 + 1;
          const right = left + 1;
          let smallest = index;
          if (left < this.items.length && this.before(this.items[left], this.items[smallest])) smallest = left;
          if (right < this.items.length && this.before(this.items[right], this.items[smallest])) smallest = right;
          if (smallest === index) break;
          [this.items[index], this.items[smallest]] = [this.items[smallest], this.items[index]];
          index = smallest;
        }
      }
      return first;
    }
  }

  // Lista enlazada simple como registro maestro. El mapa acelera las búsquedas y bloquea IDs repetidos.
  class PatientList {
    constructor() { this.head = null; this.tail = null; this.length = 0; this.byId = new Map(); }
    add(patient) {
      if (this.byId.has(patient.id)) return false;
      const node = { value: patient, next: null };
      if (this.tail) this.tail.next = node; else this.head = node;
      this.tail = node;
      this.byId.set(patient.id, patient);
      this.length += 1;
      return true;
    }
    values() {
      const result = [];
      for (let node = this.head; node; node = node.next) result.push(node.value);
      return result;
    }
  }

  const names = ['Ana Salas', 'Luis Rojas', 'María Torres', 'Carlos Vega', 'Sofía Díaz', 'Diego Ruiz', 'Elena Cruz', 'Jorge León', 'Lucía Soto', 'Mateo Paredes', 'Valeria Ríos', 'Pablo Castro', 'Camila Flores', 'Andrés Silva', 'Julia Reyes', 'Tomás Prado', 'Rosa Medina', 'Miguel Luna', 'Alma Cabrera', 'Raúl Herrera'];
  const rooms = Array.from({ length: 3 }, (_, index) => ({
    id: index + 1,
    doctor: `Dra. ${['Valdez', 'Ríos', 'Mendoza'][index]}`,
    available: true,
    patient: null,
  }));
  const state = {
    now: 0,
    mode: 'dynamic',
    patients: new PatientList(),
    queue: new MinHeap(),
    fifo: [],
    served: [],
    sequence: 0,
    duplicates: 0,
    timer: null,
  };
  const $ = selector => document.querySelector(selector);
  const severityLabel = level => ['Crítico', 'Urgente', 'Moderado', 'Leve', 'No urgente'][level - 1] || 'Sin clasificar';
  const pad = value => String(value).padStart(2, '0');
  const minuteLabel = value => `${pad(Math.floor(value / 60))}:${pad(value % 60)}`;
  const allPatients = () => state.patients.values();
  const effectivePriority = patient => Math.max(1, patient.severity - Math.floor(Math.max(0, state.now - patient.arrival) / 5));

  function toast(message) {
    const element = $('#toast');
    element.textContent = message;
    element.classList.add('show');
    clearTimeout(toast.timeout);
    toast.timeout = setTimeout(() => element.classList.remove('show'), 2600);
  }

  function queuedPatients() {
    return allPatients().filter(patient => patient.status === 'waiting');
  }

  function refreshQueues() {
    const waiting = queuedPatients();
    state.queue = new MinHeap();
    waiting.forEach(patient => state.queue.push({
      patient,
      priority: effectivePriority(patient),
      arrival: patient.arrival,
      sequence: patient.sequence,
    }));
    state.fifo = [...waiting].sort((a, b) => a.arrival - b.arrival || a.sequence - b.sequence);
  }

  function addPatient(idValue, severityValue, durationValue, nameValue) {
    const id = String(idValue || '').trim().toUpperCase();
    const name = String(nameValue || '').trim().replace(/\s+/g, ' ');
    const severity = Number(severityValue);
    const duration = Number(durationValue);
    if (!id) { toast('Escribe un identificador para registrar al paciente.'); return false; }
    if (!name) { toast('Escribe el nombre del paciente.'); return false; }
    if (!Number.isInteger(severity) || severity < 1 || severity > 5) { toast('Selecciona un nivel de gravedad entre 1 y 5.'); return false; }
    if (!Number.isInteger(duration) || duration < 1 || duration > 90) { toast('El tiempo de atención debe ser de 1 a 90 minutos.'); return false; }
    if (state.patients.byId.has(id)) {
      state.duplicates += 1;
      render();
      toast(`El identificador ${id} ya existe; no se agregó otro paciente.`);
      return false;
    }
    state.patients.add({ id, name, severity, duration, arrival: state.now, sequence: state.sequence++, status: 'waiting', started: null, ends: null, wait: null });
    dispatch();
    render();
    toast(`${id} ingresó a la cola correctamente.`);
    return true;
  }

  function dispatch() {
    refreshQueues();
    for (const room of rooms) {
      if (!room.available || room.patient) continue;
      const next = state.mode === 'dynamic' ? state.queue.pop()?.patient : state.fifo.shift();
      if (!next || next.status !== 'waiting') continue;
      next.status = 'active';
      next.started = state.now;
      next.ends = state.now + next.duration;
      room.patient = next;
    }
  }

  function tick() {
    if (!state.patients.length) { toast('Agrega pacientes o carga la secuencia de prueba antes de avanzar.'); return; }
    state.now += 1;
    for (const room of rooms) {
      if (room.patient && room.patient.ends <= state.now) {
        const patient = room.patient;
        patient.status = 'done';
        patient.wait = patient.started - patient.arrival;
        patient.finishedAt = state.now;
        patient.roomId = room.id;
        state.served.push(patient);
        room.patient = null;
      }
    }
    allPatients().forEach(patient => {
      if (patient.status === 'scheduled' && patient.arrival <= state.now) patient.status = 'waiting';
    });
    dispatch();
    render();
    stopWhenComplete();
  }

  function stopWhenComplete() {
    if (state.timer && state.patients.length && state.served.length === state.patients.length) {
      clearInterval(state.timer);
      state.timer = null;
      $('#runBtn').textContent = '✓ Simulación finalizada';
      renderControls();
      toast('Todos los pacientes fueron atendidos.');
    }
  }

  function toggleRoom(id) {
    const room = rooms.find(item => item.id === id);
    if (!room) return;
    room.available = !room.available;
    if (!room.available && room.patient) {
      const patient = room.patient;
      patient.status = 'waiting';
      patient.started = null;
      patient.ends = null;
      room.patient = null;
    }
    dispatch();
    render();
    toast(room.available ? `Consultorio ${id} reactivado.` : `Consultorio ${id} fuera de servicio; el paciente volvió a la cola.`);
  }

  function worsen(id) {
    const patient = state.patients.byId.get(id);
    if (!patient || !['waiting', 'scheduled'].includes(patient.status)) return;
    if (patient.severity === 1) { toast(`${id} ya está en el nivel crítico.`); return; }
    patient.severity -= 1;
    dispatch();
    render();
    toast(`${id}: gravedad actualizada a nivel ${patient.severity}.`);
  }

  function admitNextArrival() {
    const next = allPatients().filter(patient => patient.status === 'scheduled')
      .sort((a, b) => a.arrival - b.arrival || a.sequence - b.sequence)[0];
    if (!next) { toast('No hay llegadas programadas pendientes.'); return; }
    next.arrival = state.now;
    next.status = 'waiting';
    dispatch();
    render();
    toast(`${next.id} admitido manualmente a las ${minuteLabel(state.now)}.`);
  }

  function finishRoom(id) {
    const room = rooms.find(item => item.id === id);
    if (!room?.patient) { toast(`El consultorio ${id} no tiene una atención activa.`); return; }
    const patient = room.patient;
    patient.status = 'done';
    patient.wait = patient.started - patient.arrival;
    patient.finishedAt = state.now;
    patient.roomId = room.id;
    state.served.push(patient);
    room.patient = null;
    dispatch();
    render();
    toast(`Atención de ${patient.id} finalizada en el consultorio ${id}.`);
    stopWhenComplete();
  }

  function verifyIntegrity() {
    const patients = allPatients();
    const issues = [];
    const ids = new Set();
    patients.forEach(patient => {
      if (ids.has(patient.id)) issues.push(`ID duplicado: ${patient.id}`);
      ids.add(patient.id);
      if (state.patients.byId.get(patient.id) !== patient) issues.push(`Registro maestro inconsistente: ${patient.id}`);
      if (!['waiting', 'scheduled', 'active', 'done'].includes(patient.status)) issues.push(`Estado inválido: ${patient.id}`);
    });
    if (ids.size !== state.patients.length || state.patients.byId.size !== state.patients.length) issues.push('El registro enlazado y el índice de IDs no coinciden.');
    const servedIds = state.served.map(patient => patient.id);
    if (new Set(servedIds).size !== servedIds.length) issues.push('Hay pacientes atendidos más de una vez.');
    patients.forEach(patient => {
      const servedCount = servedIds.filter(id => id === patient.id).length;
      if (patient.status === 'done' && servedCount !== 1) issues.push(`Atención no contabilizada correctamente: ${patient.id}`);
      if (patient.status !== 'done' && servedCount !== 0) issues.push(`Paciente activo también figura como atendido: ${patient.id}`);
    });
    const activeIds = rooms.filter(room => room.patient).map(room => room.patient.id);
    if (new Set(activeIds).size !== activeIds.length) issues.push('Un paciente aparece en más de un consultorio.');
    patients.filter(patient => patient.status === 'active').forEach(patient => {
      if (activeIds.filter(id => id === patient.id).length !== 1) issues.push(`Asignación activa incorrecta: ${patient.id}`);
    });
    const lost = patients.filter(patient => !['waiting', 'scheduled', 'active', 'done'].includes(patient.status));
    if (lost.length) issues.push(`${lost.length} paciente(s) sin estado válido.`);
    const result = $('#auditResult');
    if (issues.length) {
      result.className = 'audit-result failed';
      result.textContent = `Revisión con observaciones: ${issues.join(' ')}`;
      toast('La revisión encontró inconsistencias; revisa el detalle del panel.');
    } else {
      result.className = 'audit-result passed';
      result.textContent = `Correcto: ${patients.length} registrados, ${state.served.length} atendidos una sola vez, ${patients.length - state.served.length} pendientes o en atención; sin pérdidas ni IDs duplicados.`;
      toast('Integridad verificada: no hay pacientes duplicados ni perdidos.');
    }
  }

  function exportReport() {
    if (!state.patients.length) { toast('Registra pacientes antes de descargar el reporte.'); return; }
    const quote = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const headings = ['ID', 'Paciente', 'Gravedad', 'Llegada (min)', 'Espera (min)', 'Atención estimada (min)', 'Estado', 'Prioridad efectiva'];
    const rows = allPatients().map(patient => [
      patient.id,
      patient.name,
      `${patient.severity} · ${severityLabel(patient.severity)}`,
      patient.arrival,
      patient.wait ?? (patient.status === 'waiting' ? state.now - patient.arrival : ''),
      patient.duration,
      patient.status,
      patient.status === 'waiting' ? effectivePriority(patient) : '',
    ]);
    const csv = '\ufeff' + [headings, ...rows].map(row => row.map(quote).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `reporte-hospital-minuto-${state.now}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Reporte CSV descargado.');
  }

  function printPatientTicket(id) {
    const patient = state.patients.byId.get(id);
    if (!patient) { toast('No se encontró el registro del paciente.'); return; }
    const room = rooms.find(item => item.patient?.id === patient.id) || rooms.find(item => item.id === patient.roomId);
    const waiting = state.mode === 'dynamic'
      ? [...state.queue.items].sort((a, b) => a.priority - b.priority || a.arrival - b.arrival || a.sequence - b.sequence).map(item => item.patient)
      : [...state.fifo];
    const position = waiting.findIndex(item => item.id === patient.id);
    const status = patient.status === 'active' ? 'En atención' : patient.status === 'done' ? 'Atendido' : patient.status === 'scheduled' ? 'Llegada programada' : 'En espera';
    const priority = patient.status === 'waiting' ? `Nivel ${effectivePriority(patient)}` : `Nivel ${patient.severity}`;
    const popup = window.open('', '_blank', 'width=760,height=850');
    if (!popup) { toast('El navegador bloqueó la ventana de impresión. Permite ventanas emergentes y vuelve a intentarlo.'); return; }
    popup.document.open();
    popup.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ficha ${escapeHtml(patient.id)}</title><style>*{box-sizing:border-box}body{margin:0;padding:34px;background:#eef2f4;color:#20333b;font:14px Arial,sans-serif}.ticket{max-width:620px;margin:0 auto;background:#fff;border:1px solid #dce4e7;border-radius:12px;overflow:hidden}.head{padding:24px 28px;background:#087f75;color:#fff}.brand{font-size:11px;letter-spacing:2px;font-weight:bold}.head h1{font-size:23px;margin:18px 0 4px}.head p{margin:0;color:#d6efeb;font-size:12px}.body{padding:24px 28px}.label{color:#809096;font-size:10px;letter-spacing:1.5px;font-weight:bold}.patient{display:flex;align-items:center;justify-content:space-between;padding:16px 0;border-bottom:1px solid #e8edef}.patient strong{font-size:25px;letter-spacing:1px}.badge{padding:7px 10px;border-radius:5px;background:${patient.severity === 1 ? '#fdebea' : patient.severity === 2 ? '#fff1df' : '#eaf3f4'};color:${patient.severity === 1 ? '#b84f49' : patient.severity === 2 ? '#a66c22' : '#54727b'};font-size:11px;font-weight:bold}.grid{display:grid;grid-template-columns:1fr 1fr;gap:0 22px;margin-top:15px}.cell{padding:13px 0;border-bottom:1px solid #eef1f2}.cell span{display:block;margin-bottom:5px;color:#849197;font-size:10px;text-transform:uppercase;letter-spacing:.7px}.cell b{font-size:13px}.notice{margin-top:20px;padding:12px;border-radius:6px;background:#f3f8f7;color:#55736e;font-size:11px;line-height:1.5}.foot{padding:14px 28px;border-top:1px solid #e8edef;color:#92a0a5;font-size:9px}.print{display:block;margin:18px auto 0;border:0;border-radius:6px;padding:11px 20px;background:#087f75;color:#fff;font-weight:bold;cursor:pointer}@media print{body{padding:0;background:#fff}.ticket{max-width:none;border:0;border-radius:0}.print{display:none}}</style></head><body><main class="ticket"><header class="head"><div class="brand">✚ &nbsp; HOSPITAL · CENTRO DE MANDO</div><h1>Ficha de atención</h1><p>Comprobante de turno del simulador de emergencias</p></header><section class="body"><div class="label">IDENTIFICACIÓN DEL PACIENTE</div><div class="patient"><strong>${escapeHtml(patient.id)}</strong><span class="badge">NIVEL ${patient.severity} · ${severityLabel(patient.severity).toUpperCase()}</span></div><div class="grid"><div class="cell"><span>Paciente</span><b>${escapeHtml(patient.name)}</b></div><div class="cell"><span>Estado</span><b>${status}</b></div><div class="cell"><span>Hora de llegada</span><b>${minuteLabel(patient.arrival)}</b></div><div class="cell"><span>Prioridad efectiva</span><b>${priority}</b></div><div class="cell"><span>Tiempo estimado</span><b>${patient.duration} minutos</b></div><div class="cell"><span>Consultorio</span><b>${room ? `Consultorio ${room.id} · ${room.doctor}` : 'En espera de asignación'}</b></div><div class="cell"><span>Tiempo de espera</span><b>${patient.status === 'done' ? `${patient.wait} minutos` : `${Math.max(0, state.now - patient.arrival)} minutos`}</b></div><div class="cell"><span>Posición en cola</span><b>${position >= 0 ? `${position + 1} de ${waiting.length}` : '—'}</b></div></div><div class="notice">La prioridad dinámica puede actualizarse según la gravedad y el tiempo de espera. Este comprobante pertenece a una simulación académica y no reemplaza documentación clínica.</div></section><footer class="foot">MINUTO SIMULADO ${state.now} · TRIAJE ${state.mode === 'dynamic' ? 'DINÁMICO' : 'FIFO'}</footer></main><button class="print" onclick="window.print()">Imprimir ficha</button></body></html>`);
    popup.document.close();
    setTimeout(() => { popup.focus(); popup.print(); }, 350);
  }

  function renderControls() {
    const hasPatients = state.patients.length > 0;
    const complete = hasPatients && state.served.length === state.patients.length;
    $('#runBtn').disabled = !hasPatients || complete;
    $('#stepBtn').disabled = !hasPatients;
    $('#generateBtn').disabled = hasPatients;
    $('#admitNextBtn').disabled = !allPatients().some(patient => patient.status === 'scheduled');
    $('#worsenNextBtn').disabled = !allPatients().some(patient => ['waiting', 'scheduled'].includes(patient.status) && patient.severity > 1);
    $('#exportBtn').disabled = !hasPatients;
    if (complete) $('#runBtn').innerHTML = '✓ Simulación finalizada';
    else if (!hasPatients) $('#runBtn').innerHTML = '<span class="button-icon">▶</span> Iniciar simulación';
    else if (!state.timer && $('#runBtn').textContent.includes('finalizada')) $('#runBtn').innerHTML = '<span class="button-icon">▶</span> Iniciar simulación';
    const worsenable = allPatients().filter(patient => ['waiting', 'scheduled'].includes(patient.status) && patient.severity > 1).length;
    $('#worsenThreeBtn').disabled = worsenable < 3;
  }

  function render() {
    refreshQueues();
    const patients = allPatients();
    const waiting = queuedPatients();
    const busy = rooms.filter(room => room.patient).length;
    const available = rooms.filter(room => room.available).length;
    const avgWait = state.served.length ? Math.round(state.served.reduce((sum, patient) => sum + patient.wait, 0) / state.served.length) : 0;

    $('#waitingCount').textContent = waiting.length;
    $('#upcomingCount').textContent = patients.filter(patient => patient.status === 'scheduled').length;
    $('#activeCount').textContent = busy;
    $('#doneCount').textContent = state.served.length;
    $('#criticalCount').textContent = patients.filter(patient => patient.status !== 'done' && patient.severity === 1).length;
    $('#avgWait').innerHTML = `${avgWait} <small>min</small>`;
    $('#timeLabel').textContent = `MINUTO ${state.now}`;
    $('#clock').textContent = minuteLabel(state.now);
    $('#queueBadge').textContent = waiting.length;
    $('#roomSummary').textContent = `${available} de ${rooms.length} disponibles`;

    $('#rooms').innerHTML = rooms.map(room => {
      const patient = room.patient;
      const remaining = patient ? Math.max(0, patient.ends - state.now) : 0;
      const progress = patient ? Math.max(0, Math.min(100, 100 * (patient.duration - remaining) / patient.duration)) : 0;
      const status = !room.available ? 'FUERA DE SERVICIO' : patient ? 'EN ATENCIÓN' : 'DISPONIBLE';
      const roomCopy = patient ? `${escapeHtml(patient.id)}<small>${escapeHtml(patient.name)} · Nivel ${patient.severity} ${severityLabel(patient.severity)}</small>` : `${room.available ? 'Sin paciente' : 'Recurso desactivado'}<small>${room.doctor}</small>`;
      return `<article class="room"><div class="room-top"><span class="room-name">Consultorio ${room.id}</span><span class="status ${!room.available ? 'off' : patient ? 'busy' : ''}">${status}</span></div><div class="room-body"><div class="room-patient">${roomCopy}</div><div class="room-progress"><i style="width:${progress}%"></i></div></div><div class="room-foot"><span>${patient ? `Atención · ${patient.duration} min` : room.doctor}</span><span>${patient ? `${remaining} min restantes` : ''}</span></div><div class="room-actions">${patient ? `<button type="button" class="room-finish" data-finish="${room.id}">Finalizar</button><button type="button" class="room-print" data-print="${escapeHtml(patient.id)}">Imprimir ficha</button>` : '<span></span>'}<button class="room-action" type="button" data-room="${room.id}">${room.available ? 'Desactivar' : 'Reactivar'}</button></div></article>`;
    }).join('');

    const ordered = state.mode === 'dynamic'
      ? [...state.queue.items].sort((a, b) => a.priority - b.priority || a.arrival - b.arrival || a.sequence - b.sequence).map(item => item.patient)
      : [...state.fifo];
    $('#queueRows').innerHTML = ordered.map((patient, index) => {
      const priority = state.mode === 'dynamic' ? `Nivel ${effectivePriority(patient)}` : `Turno ${index + 1}`;
      const actionDisabled = patient.severity === 1 ? 'disabled' : '';
      return `<tr><td class="pid">${escapeHtml(patient.id)}<small class="patient-name">${escapeHtml(patient.name)}</small></td><td><span class="severity s${patient.severity}">N${patient.severity} · ${severityLabel(patient.severity)}</span></td><td>${minuteLabel(patient.arrival)}</td><td>${state.now - patient.arrival} min</td><td class="priority">${priority}</td><td class="row-actions"><button type="button" class="ticket-btn" data-print="${escapeHtml(patient.id)}" aria-label="Imprimir ficha de ${escapeHtml(patient.id)}">Imprimir</button><button type="button" class="action-btn" data-worsen="${escapeHtml(patient.id)}" aria-label="Empeorar gravedad de ${escapeHtml(patient.id)}" ${actionDisabled}>Empeoró ↓</button></td></tr>`;
    }).join('');
    $('#emptyQueue').style.display = ordered.length ? 'none' : 'block';
    $('#queueRows').parentElement.style.display = ordered.length ? 'table' : 'none';

    $('#servedRows').innerHTML = [...state.served].reverse().map(patient => `<tr><td class="pid">${escapeHtml(patient.name)}<small class="patient-name">${escapeHtml(patient.id)}</small></td><td><span class="severity s${patient.severity}">N${patient.severity} · ${severityLabel(patient.severity)}</span></td><td>${minuteLabel(patient.arrival)}</td><td>${minuteLabel(patient.finishedAt ?? state.now)}</td><td>${patient.wait} min</td><td><button type="button" class="ticket-btn" data-print="${escapeHtml(patient.id)}" aria-label="Imprimir ficha de ${escapeHtml(patient.id)}">Imprimir ficha</button></td></tr>`).join('');
    $('#servedCount').textContent = state.served.length;
    $('#emptyServed').style.display = state.served.length ? 'none' : 'block';
    $('#servedRows').parentElement.style.display = state.served.length ? 'table' : 'none';

    $('#staffList').innerHTML = rooms.map(room => `<div class="doctor-row"><div class="doctor-meta"><span class="doctor-avatar">✚</span><span><b>${room.doctor}</b><small>Consultorio ${room.id} · ${room.available ? 'En turno' : 'Fuera de servicio'}</small></span></div><input aria-label="Disponibilidad de ${room.doctor}" class="switch" type="checkbox" data-room="${room.id}" ${room.available ? 'checked' : ''}></div>`).join('');
    $('#registeredTotal').textContent = state.patients.length;
    $('#systemTotal').textContent = patients.length;
    $('#duplicateTotal').textContent = state.duplicates;
    $('#lostTotal').textContent = patients.filter(patient => !['waiting', 'scheduled', 'active', 'done'].includes(patient.status)).length;
    $('#agingNote').style.display = state.mode === 'dynamic' ? 'flex' : 'none';
    document.querySelectorAll('.mode-switch button').forEach(button => button.classList.toggle('selected', button.dataset.mode === state.mode));
    renderControls();
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  }

  function randomSequence() {
    let seed = 20261029;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    return Array.from({ length: 40 }, (_, index) => ({
      id: `P-${String(index + 1).padStart(3, '0')}`,
      name: names[Math.floor(random() * names.length)],
      severity: 1 + Math.floor(random() * 5),
      arrival: Math.floor(index / 2),
      duration: 5 + Math.floor(random() * 11),
      sequence: index,
    }));
  }

  function generate() {
    if (state.patients.length) { toast('Reinicia la simulación antes de cargar otra secuencia.'); return; }
    randomSequence().forEach(patient => state.patients.add({ ...patient, status: patient.arrival <= state.now ? 'waiting' : 'scheduled', started: null, ends: null, wait: null }));
    state.sequence = 40;
    dispatch();
    render();
    toast('40 pacientes cargados. Llegan en intervalos de 2 minutos.');
  }

  function simulate(mode, sequence) {
    let now = 0;
    let arrivalIndex = 0;
    let waiting = [];
    let servedWait = [];
    const resources = Array.from({ length: 3 }, () => null);
    let guard = 0;
    while (servedWait.length < sequence.length && guard < 10000) {
      guard += 1;
      resources.forEach((resource, index) => {
        if (resource && resource.ends <= now) {
          servedWait.push(resource.started - resource.patient.arrival);
          resources[index] = null;
        }
      });
      while (arrivalIndex < sequence.length && sequence[arrivalIndex].arrival <= now) waiting.push({ ...sequence[arrivalIndex] });
      arrivalIndex = sequence.findIndex(patient => patient.arrival > now);
      if (arrivalIndex < 0) arrivalIndex = sequence.length;
      if (mode === 'dynamic') {
        waiting.forEach(patient => { patient.priority = Math.max(1, patient.severity - Math.floor((now - patient.arrival) / 5)); });
        waiting.sort((a, b) => a.priority - b.priority || a.arrival - b.arrival || a.sequence - b.sequence);
      } else waiting.sort((a, b) => a.arrival - b.arrival || a.sequence - b.sequence);
      for (let index = 0; index < resources.length; index += 1) {
        if (resources[index] || !waiting.length) continue;
        const patient = waiting.shift();
        resources[index] = { patient, started: now, ends: now + patient.duration };
      }
      now += 1;
    }
    const avg = servedWait.length ? Math.round(servedWait.reduce((sum, wait) => sum + wait, 0) / servedWait.length) : 0;
    return { average: avg, completedAt: now, served: servedWait.length };
  }

  function compare() {
    const sequence = randomSequence();
    const fifo = simulate('fifo', sequence);
    const dynamic = simulate('dynamic', sequence);
    const difference = Math.abs(fifo.average - dynamic.average);
    const result = dynamic.average < fifo.average
      ? `La prioridad dinámica redujo la espera promedio en ${difference} min en esta secuencia.`
      : dynamic.average > fifo.average
        ? `FIFO tuvo ${difference} min menos de espera promedio en esta secuencia.`
        : 'Los dos modos obtuvieron la misma espera promedio en esta secuencia.';
    $('#comparison').innerHTML = `<div class="comparison-grid"><div class="comparison-item"><span>FIFO · ESPERA PROMEDIO</span><b>${fifo.average} min</b><span>Atención completa: ${fifo.completedAt} min</span></div><div class="comparison-item"><span>TRIAJE DINÁMICO · ESPERA</span><b>${dynamic.average} min</b><span>Atención completa: ${dynamic.completedAt} min</span></div></div><p class="comparison-caption">${result} Casos atendidos: ${fifo.served} de 40 en ambos modos.</p>`;
    $('#comparison').classList.remove('hidden');
  }

  $('#patientForm').addEventListener('submit', event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (addPatient(form.get('id'), form.get('severity'), form.get('duration'), form.get('name'))) event.currentTarget.reset();
  });
  $('#stepBtn').addEventListener('click', tick);
  $('#runBtn').addEventListener('click', () => {
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
      $('#runBtn').innerHTML = '<span class="button-icon">▶</span> Reanudar simulación';
    } else {
      if (!state.patients.length) { toast('Agrega pacientes o carga la secuencia de prueba para iniciar.'); return; }
      $('#runBtn').innerHTML = '<span class="button-icon">Ⅱ</span> Pausar simulación';
      state.timer = setInterval(tick, 650);
    }
    renderControls();
  });
  $('#resetBtn').addEventListener('click', () => {
    clearInterval(state.timer);
    state.timer = null;
    state.now = 0;
    state.mode = 'dynamic';
    state.patients = new PatientList();
    state.queue = new MinHeap();
    state.fifo = [];
    state.served = [];
    state.sequence = 0;
    state.duplicates = 0;
    rooms.forEach(room => { room.patient = null; room.available = true; });
    $('#runBtn').innerHTML = '<span class="button-icon">▶</span> Iniciar simulación';
    $('#comparison').classList.add('hidden');
    render();
    toast('Simulación reiniciada.');
  });
  $('#generateBtn').addEventListener('click', generate);
  $('#compareBtn').addEventListener('click', compare);
  $('#admitNextBtn').addEventListener('click', admitNextArrival);
  $('#verifyBtn').addEventListener('click', verifyIntegrity);
  $('#exportBtn').addEventListener('click', exportReport);
  $('#worsenNextBtn').addEventListener('click', () => {
    const waiting = queuedPatients().sort((a, b) => effectivePriority(a) - effectivePriority(b) || a.arrival - b.arrival || a.sequence - b.sequence);
    const next = waiting.find(patient => patient.severity > 1) || allPatients().filter(patient => patient.status === 'scheduled' && patient.severity > 1).sort((a, b) => a.arrival - b.arrival || a.sequence - b.sequence)[0];
    if (!next) { toast('No hay pacientes pendientes cuya gravedad pueda empeorar.'); return; }
    worsen(next.id);
  });
  $('#worsenThreeBtn').addEventListener('click', () => {
    const candidates = allPatients().filter(patient => ['waiting', 'scheduled'].includes(patient.status) && patient.severity > 1).slice(0, 3);
    if (candidates.length < 3) { toast('Se necesitan 3 pacientes no críticos en espera. Registra más o carga la secuencia.'); return; }
    candidates.forEach(patient => { patient.severity -= 1; });
    dispatch();
    render();
    toast('Tres pacientes empeoraron; la cola actualizó sus prioridades sin duplicarlos.');
  });
  $('#staffList').addEventListener('change', event => {
    const control = event.target.closest('.switch[data-room]');
    if (control) toggleRoom(Number(control.dataset.room));
  });
  $('#rooms').addEventListener('click', event => {
    const finishControl = event.target.closest('.room-finish[data-finish]');
    if (finishControl) { finishRoom(Number(finishControl.dataset.finish)); return; }
    const printControl = event.target.closest('.room-print[data-print]');
    if (printControl) { printPatientTicket(printControl.dataset.print); return; }
    const control = event.target.closest('.room-action[data-room]');
    if (control) toggleRoom(Number(control.dataset.room));
  });
  $('#queueRows').addEventListener('click', event => {
    const printControl = event.target.closest('[data-print]');
    if (printControl) { printPatientTicket(printControl.dataset.print); return; }
    const control = event.target.closest('[data-worsen]');
    if (control && !control.disabled) worsen(control.dataset.worsen);
  });
  $('.mode-switch').addEventListener('click', event => {
    const control = event.target.closest('button[data-mode]');
    if (!control) return;
    state.mode = control.dataset.mode;
    dispatch();
    render();
  });

  render();
})();
