// ============================================================
// INVESTOR TRACKER - ADMIN PANEL
// Backend: Supabase (project yang sama dengan aplikasi_admin_only)
// ============================================================

// --- GANTI SESUAI KEBUTUHAN ---
const SUPABASE_URL = 'https://ismjupxoiywttkrekmfg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzbWp1cHhvaXl3dHRrcmVrbWZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNzc4MDEsImV4cCI6MjA5NDg1MzgwMX0.WVwqEdkPQ_x9NWR8QXTm85mIAvN8d9V2FaMJ2NiAMC0';
const ADMIN_PIN = '1234'; // <-- GANTI PIN OWNER DI SINI
const SESSION_KEY = 'investor_tracker_admin_session_v1';
// --------------------------------

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
const rp = (n) => `Rp ${new Intl.NumberFormat('id-ID').format(Math.round(Number(n || 0)))}`;
const now = () => new Date();
const dateKey = (d = now()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const monthKey = (d = now()) => dateKey(d).slice(0, 7);
const normName = (v) => String(v || '').replace(/\s+/g, ' ').trim().toUpperCase();

window.formatRupiahInput = function(el) {
  let val = el.value.replace(/[^0-9]/g, '');
  if (!val) { el.value = ''; return; }
  el.value = parseInt(val, 10).toLocaleString('id-ID');
};
window.parseRupiahInput = function(val) {
  return Number(String(val).replace(/[^0-9]/g, '')) || 0;
};
function last12Months() {
  const out = [];
  const base = now();
  for (let i = 0; i < 12; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    out.push(monthKey(d));
  }
  return out;
}

const state = {
  page: 'dashboard',
  investors: [],
  projects: [],
  batches: [],
  investorProducts: [],
  distributions: [],
  batchStats: {},
  statsRange: 3,
  catalog: [],       // investment_batch_catalog
  purchases: [],     // investment_purchases dengan detail
};

function toast(msg, err = false) {
  const el = $('toast');
  el.textContent = msg;
  el.className = 'toast show' + (err ? ' err' : '');
  setTimeout(() => { el.className = 'toast'; }, 2600);
}
function setBusy(v) { $('loading').className = v ? 'loading show' : 'loading'; }

// ============ AUTH (PIN) ============
let pinBuffer = '';
function renderPinScreen() {
  $('app').innerHTML = `
    <div class="pin-screen">
      <div style="width:64px;height:64px;border-radius:18px;background:var(--primary-soft);display:flex;align-items:center;justify-content:center">
        <i class="fas fa-chart-line" style="font-size:26px;color:var(--primary)"></i>
      </div>
      <div style="text-align:center">
        <div style="font-weight:800;font-size:17px">Investor Tracker</div>
        <div class="meta">Masukkan Username dan PIN admin</div>
      </div>
      
      <div style="display:flex; flex-direction:column; gap:12px; margin-top:24px; width:100%; max-width:300px;">
        <input type="text" id="loginUsername" class="input" placeholder="Username (contoh: admin)" style="text-align:center;font-weight:bold;text-transform:lowercase; padding:12px">
        <div style="position:relative">
          <input type="password" pattern="[0-9]*" inputmode="numeric" id="loginPin" class="input" placeholder="PIN Angka" style="text-align:center;font-weight:bold;letter-spacing:4px; padding:12px; width:100%; box-sizing:border-box" onkeydown="if(event.key==='Enter') attemptLogin()">
          <button onclick="togglePin()" style="position:absolute; right:12px; top:50%; transform:translateY(-50%); background:none; border:none; color:var(--text-muted); cursor:pointer"><i id="eyeIcon" class="fas fa-eye"></i></button>
        </div>
      </div>
      <button class="btn success full" style="padding:14px; margin-top:20px; max-width:300px;" onclick="attemptLogin()"><i class="fas fa-sign-in-alt"></i> Masuk</button>
    </div>
  `;
}

window.togglePin = function() {
  const pinInput = $('loginPin');
  const eyeIcon = $('eyeIcon');
  if (pinInput.type === 'password') {
    pinInput.type = 'text'; 
    eyeIcon.className = 'fas fa-eye-slash';
  } else {
    pinInput.type = 'password';
    eyeIcon.className = 'fas fa-eye';
  }
};

window.attemptLogin = async function () {
  const username = ($('loginUsername')?.value || '').trim();
  const pin = ($('loginPin')?.value || '').trim();
  
  if (!username || !pin) return toast('Masukkan Username dan PIN!', true);

  setBusy(true);
  try {
    // Check if table exists and has rows
    const { data: allAdmins, error: listError } = await sb.from('admin_users').select('id').limit(1);
    
    // If table doesn't exist or is completely empty, allow fallback
    if (listError || !allAdmins || allAdmins.length === 0) {
      if (username === 'admin' && pin === String(ADMIN_PIN)) {
        localStorage.setItem(SESSION_KEY, JSON.stringify({ id: 'fallback', username: 'admin', pin: String(ADMIN_PIN), is_fallback: true }));
        boot();
        return;
      } else {
        if (listError && listError.code === '42P01') {
          return toast('Tabel admin_users belum dibuat. Login default: admin / ' + ADMIN_PIN, true);
        }
        return toast('Username atau PIN salah', true);
      }
    }

    // Table exists and has at least 1 admin, verify credentials
    const { data, error } = await sb.from('admin_users')
      .select('*')
      .ilike('username', username)
      .eq('pin', pin)
      .single();
      
    if (error) throw error;
    
    if (data) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(data));
      boot();
    }
  } catch (e) {
    console.error(e);
    toast('Username atau PIN salah', true);
  } finally {
    setBusy(false);
  }
};
window.logoutAdmin = function () {
  localStorage.removeItem(SESSION_KEY);
  renderPinScreen();
};

// ============ DATA LOADERS ============
async function loadInvestors() {
  const { data, error } = await sb.from('investors').select('*').order('created_at', { ascending: false });
  if (!error) state.investors = data || [];
}
async function loadBatches() {
  const { data, error } = await sb.from('investment_batches').select('*, investors(name,phone)').order('created_at', { ascending: false });
  if (!error) state.batches = data || [];
}
async function loadProjects() {
  const { data, error } = await sb.from('projects').select('*').order('created_at', { ascending: false });
  if (!error) state.projects = data || [];
}
async function loadInvestorProducts() {
  const { data, error } = await sb.from('produk').select('*').eq('is_investor', true);
  if (!error) state.investorProducts = data || [];
}
async function loadDistributions() {
  const { data, error } = await sb.from('profit_distributions').select('*, investment_batches(batch_name, investors(name))').order('created_at', { ascending: false }).limit(100);
  if (!error) state.distributions = data || [];
}

// Ambil transaksi 1 bulan dari tabel `transactions` (kompatibel dengan skema
// { id text, data jsonb } yang dipakai aplikasi_admin_only & kasir staff).
async function fetchMonthTransactions(mk) {
  const out = [];
  let from = 0;
  const pageSize = 1000;
  for (let i = 0; i < 10; i++) {
    const to = from + pageSize - 1;
    const { data, error } = await sb.from('transactions').select('id,data')
      .eq('data->>monthKey', mk).range(from, to);
    if (error) { console.error('fetchMonthTransactions', error); break; }
    if (!data || !data.length) break;
    out.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return out.map(r => ({ id: r.id, ...(r.data || {}) }));
}

function parseNoteLines(note) {
  return String(note || '').split(/\r?\n/).map(line => {
    const parts = line.split(/ qty /i);
    const name = normName(parts[0] || '');
    const qty = parts.length > 1 ? (parseInt(parts[1], 10) || 1) : 1;
    return { name, qty };
  }).filter(l => l.name);
}

// Hitung omzet & modal per batch investor dari transaksi N bulan terakhir.
async function computeAllBatchStats(monthsBack = 3) {
  const finalStats = {};
  state.batches.forEach(b => {
    const bName = String(b.batch_name).trim().toLowerCase();
    const assignedProj = (state.projects || []).find(p => String(p.name).trim().toLowerCase() === bName);
    const projId = assignedProj ? assignedProj.id : null;
    
    const batchProduct = (state.investorProducts || []).find(p => 
      p.investor_batch_id === b.id || 
      (projId && p.investor_batch_id === projId)
    );
    const initPersen = batchProduct ? Number(batchProduct.persentase_keuntungan_investor || 30) : 30;

    finalStats[b.id] = { omzet: 0, modal: 0, netProfit: 0, investorShare: 0, ownerShare: 0, txCount: 0, needsReview: 0, persen: initPersen, batchName: b.batch_name };
  });
  const productMap = new Map(state.investorProducts.map(p => [normName(p.nama_produk), p]));
  if (!productMap.size) { state.batchStats = finalStats; return; }

  const months = last12Months().slice(0, monthsBack);

  // Ambil batch yang statusnya AKTIF
  const activeBatches = state.batches.filter(b => String(b.status).toUpperCase() === 'ACTIVE');

  for (const mk of months) {
    const txs = await fetchMonthTransactions(mk);
    for (const t of txs) {
      if (t.deleted) continue;
      if (t.note && t.note.startsWith('[MANUAL_PROFIT]')) {
        const match = t.note.match(/BATCH_ID=([a-zA-Z0-9-]+)\s+AMOUNT=([-0-9.]+)/);
        if (match) {
          const bId = match[1];
          const pAmt = Number(match[2]);
          if (finalStats[bId]) {
            finalStats[bId].investorShare += pAmt;
            finalStats[bId].netProfit += pAmt; // Count as net profit too
            finalStats[bId].txCount += 1;
          }
        }
        continue;
      }
      const lines = parseNoteLines(t.note);
      if (!lines.length) continue;
      
      let lineTotal = 0;
      let txAssignedToBatch = new Set();
      
      for (const line of lines) {
        const prod = productMap.get(line.name);
        if (!prod) continue;
        const bId = prod.investor_batch_id;
        if (!bId) continue;
        
        let pName = '';
        const assignedBatch = state.batches.find(x => x.id === bId);
        if (assignedBatch) {
          pName = String(assignedBatch.batch_name).trim().toLowerCase();
        } else {
          const assignedProj = state.projects.find(x => x.id === bId);
          if (assignedProj) pName = String(assignedProj.name).trim().toLowerCase();
          else continue;
        }
        
        const txTime = new Date(t.created_at || t.createdAt || t.dateKey || 0).getTime();
        const eligibleBatches = activeBatches.filter(b => {
          if (String(b.batch_name).trim().toLowerCase() !== pName) return false;
          // Gunakan start_date (Bulan Aktif) jika ada, jika tidak fallback ke created_at
          const bTime = new Date(b.start_date || b.created_at || 0).getTime();
          return bTime <= txTime;
        });

        const eligibleProjCap = eligibleBatches.reduce((sum, b) => sum + Number(b.amount_invested || 0), 0);
        if (eligibleProjCap === 0) continue; // Abaikan jika belum ada investor yang join pada saat transaksi ini

        const omzetLine = line.qty * Number(prod.harga_jual || 0);
        const modalLine = line.qty * Number(prod.modal || 0);
        const persen = Number(prod.persentase_keuntungan_investor || 30);
        const netProfitLine = omzetLine - modalLine;
        const invShareLine = netProfitLine * (persen / 100);
        
        lineTotal += omzetLine;
        
        // Distribusi profit HANYA ke investor yang eligible pada tanggal transaksi
        for (const pb of eligibleBatches) {
          const ratio = Number(pb.amount_invested || 0) / eligibleProjCap;
          
          finalStats[pb.id].omzet += (omzetLine * ratio);
          finalStats[pb.id].modal += (modalLine * ratio);
          finalStats[pb.id].netProfit += (netProfitLine * ratio);
          finalStats[pb.id].investorShare += (invShareLine * ratio);
          finalStats[pb.id].ownerShare += ((netProfitLine - invShareLine) * ratio);
          finalStats[pb.id].persen = persen;
          
          txAssignedToBatch.add(pb.id);
        }
      }
      
      const mismatch = Math.abs(lineTotal - Number(t.amount || 0)) > 1;
      
      txAssignedToBatch.forEach(bId => {
        finalStats[bId].txCount += 1;
        if (mismatch) finalStats[bId].needsReview += 1;
      });
    }
  }

  // Hitung total profit yang sudah dicairkan (semua status, baik pending maupun paid)
  state.distributions.forEach(d => {
    if (finalStats[d.batch_id]) {
      finalStats[d.batch_id].withdrawnAmount = (finalStats[d.batch_id].withdrawnAmount || 0) + Number(d.investor_share_amount || 0);
    }
  });

  state.batchStats = finalStats;
}

// ============ RENDER ============
function tabBar() {
  const tabs = [
    ['dashboard', 'fa-gauge-high', 'Dashboard'],
    ['investors', 'fa-user-tie', 'Investor'],
    ['projects', 'fa-briefcase', 'Master Proyek'],
    ['batches', 'fa-layer-group', 'Batch Inv'],
    ['distribution', 'fa-hand-holding-dollar', 'Pencairan'],
    ['lotmgmt', 'fa-cart-shopping', 'Lot & Pembelian'],
    ['pengaturan', 'fa-cog', 'Pengaturan'],
  ];
  return `<nav class="tabs">${tabs.map(([p, icon, label]) => `
    <button class="tab ${state.page === p ? 'active' : ''}" onclick="go('${p}')">
      <i class="fas ${icon}"></i><span>${label}</span>
    </button>`).join('')}</nav>`;
}
function header(title, sub) {
  return `<div class="header">
    <div class="row" style="align-items:flex-start">
      <div><h1>${esc(title)}</h1><div class="sub">${esc(sub || '')}</div></div>
      <button onclick="logoutAdmin()" style="background:rgba(255,255,255,.18);border:none;color:#fff;width:34px;height:34px;border-radius:10px;cursor:pointer"><i class="fas fa-lock"></i></button>
    </div>
  </div>`;
}

window.go = function (page) {
  state.page = page;
  render();
  // Auto-refresh data saat buka tab Lot & Pembelian
  if (page === 'lotmgmt') {
    Promise.all([loadCatalog(), loadPurchases()]).then(() => render());
  }
};

function render() {
  let body = '';
  if (state.page === 'dashboard') body = renderDashboard();
  else if (state.page === 'investors') body = renderInvestors();
  else if (state.page === 'projects') body = renderProjects();
  else if (state.page === 'batches') body = renderBatches();
  else if (state.page === 'distribution') body = renderDistribution();
  else if (state.page === 'lotmgmt') body = renderLotManagement();
  $('app').innerHTML = body + tabBar();
}

function renderDashboard() {
  const activeBatches = state.batches.filter(b => b.status === 'active');
  const totalInvested = state.batches.reduce((s, b) => s + Number(b.amount_invested || 0), 0);
  const statEntries = Object.entries(state.batchStats);
  const totalOmzet = statEntries.reduce((s, [, v]) => s + v.omzet, 0);
  const totalProfit = statEntries.reduce((s, [, v]) => s + v.netProfit, 0);

  return `
    ${header('Investor Tracker', 'Dashboard Owner')}
    <div class="content">
      <div class="grid2 mb">
        <div class="card pad">
          <div class="stat-label">Total Dana Masuk</div>
          <div class="stat-val">${rp(totalInvested)}</div>
        </div>
        <div class="card pad">
          <div class="stat-label">Batch Aktif</div>
          <div class="stat-val">${activeBatches.length}</div>
        </div>
      </div>
      <div class="card pad mb">
        <div class="row">
          <div>
            <div class="stat-label">Omzet Produk Investor (${state.statsRange} bln terakhir)</div>
            <div class="stat-val">${rp(totalOmzet)}</div>
            <div class="meta">Profit bersih: ${rp(totalProfit)}</div>
          </div>
          <button class="btn primary" onclick="refreshStats()"><i class="fas fa-rotate"></i> Hitung</button>
        </div>
        <div class="sep"></div>
        <div class="meta">Rentang: <select id="rangeSelect" class="input" style="display:inline-block;width:auto;padding:6px 10px;margin-left:6px" onchange="state.statsRange=Number(this.value)">
          ${[1,2,3,6,12].map(n => `<option value="${n}" ${state.statsRange===n?'selected':''}>${n} bulan</option>`).join('')}
        </select></div>
      </div>
      <div class="tiny mb">Per Batch / Proyek</div>
      ${(() => {
        if (!state.batches.length) return `<div class="empty">Belum ada batch investasi. Tambah di tab Batch.</div>`;
        
        // Group by batch_name
        const groups = {};
        state.batches.forEach(b => {
          const name = (b.batch_name || 'Tanpa Nama').trim();
          if (!groups[name]) groups[name] = [];
          groups[name].push(b);
        });

        return Object.entries(groups).map(([groupName, groupBatches]) => {
          // Calculate group totals
          let grpOmzet = 0, grpModal = 0, grpNetProfit = 0, grpInvestorShare = 0, grpWithdrawn = 0, grpNeedsReview = 0;
          let grpTotalInvested = 0;
          let isActive = false;
          let persen = 0;
          
          groupBatches.forEach(b => {
            if (b.status === 'active') isActive = true;
            grpTotalInvested += Number(b.amount_invested || 0);
            const s = state.batchStats[b.id];
            if (s) {
              grpOmzet += s.omzet;
              grpModal += s.modal;
              grpNetProfit += s.netProfit;
              grpInvestorShare += s.investorShare;
              grpWithdrawn += (s.withdrawnAmount || 0);
              grpNeedsReview += (s.needsReview || 0);
              if (s.persen > 0) persen = s.persen;
            }
          });
          
          const sisaBelumCair = grpInvestorShare - grpWithdrawn;
          const groupId = 'grp-' + groupName.replace(/[^a-zA-Z0-9]/g, '');

          return `
          <div class="card pad mb" style="border: 2px solid var(--border); box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
            <div class="row" style="cursor:pointer;" onclick="toggleGroup('${groupId}')">
              <div>
                <div class="title" style="font-size:1.2rem;font-weight:900;">${esc(groupName)}</div>
                <div class="meta">${groupBatches.length} Investor &bull; Total Modal ${rp(grpTotalInvested)}</div>
              </div>
              <div style="display:flex;align-items:center;gap:10px;">
                <span class="chip ${isActive ? 'active' : 'closed'}">${isActive ? 'AKTIF' : 'CLOSED'}</span>
                <i id="icon-${groupId}" class="fas fa-chevron-down" style="color:var(--text-muted);transition:transform 0.3s;"></i>
              </div>
            </div>
            
            <div class="sep"></div>
            <div class="grid2" style="background:var(--bg); border:1px solid var(--border); border-radius:8px; padding:12px; margin-bottom:12px;">
              <div><div class="stat-label">Omzet Proyek</div><div style="font-weight:600">${rp(grpOmzet)}</div></div>
              <div><div class="stat-label">Modal Terjual</div><div style="font-weight:600">${rp(grpModal)}</div></div>
              <div><div class="stat-label">Profit Bersih</div><div style="font-weight:800">${rp(grpNetProfit)}</div></div>
              <div>
                <div class="stat-label">Bagian Investor (${persen}%)</div>
                <div style="font-weight:800;color:var(--primary)">${rp(grpInvestorShare)}</div>
              </div>
              ${grpWithdrawn ? `
              <div>
                <div class="stat-label">Telah Dicairkan</div>
                <div style="font-weight:600;color:var(--text-muted)">${rp(grpWithdrawn)}</div>
              </div>
              <div>
                <div class="stat-label">Sisa Belum Cair</div>
                <div style="font-weight:800;color:${sisaBelumCair > 0 ? 'var(--warning)' : 'var(--success)'}">${rp(sisaBelumCair)}</div>
              </div>
              ` : ''}
            </div>
            ${grpNeedsReview ? `<div class="meta" style="color:var(--danger);margin-bottom:12px"><i class="fas fa-triangle-exclamation"></i> ${grpNeedsReview} transaksi perlu dicek manual (harga_jual mungkin belum sesuai)</div>` : ''}
            
            <div id="${groupId}" style="display:none; margin-top:16px; border-top:1px dashed var(--border); padding-top:16px;">
              <h4 style="font-size:0.9rem; font-weight:800; color:var(--text-muted); margin-bottom:12px;">Rincian Tiap Investor:</h4>
              ${groupBatches.map(b => {
                const s = state.batchStats[b.id];
                return `
                <div style="background:#FFF; border:1px solid var(--border); border-radius:8px; padding:12px; margin-bottom:12px;">
                  <div class="row" style="margin-bottom:8px;">
                    <div>
                      <div style="font-weight:800;">${esc(b.investors?.name || '-')}</div>
                      <div class="meta">Modal ${rp(b.amount_invested)}</div>
                      ${s && s.ownershipRatio !== undefined ? `<div class="meta" style="color:var(--primary);margin-top:2px;font-weight:600">Porsi Kepemilikan: ${s.ownershipRatio.toFixed(1)}%</div>` : ''}
                    </div>
                    <span class="chip ${b.status === 'active' ? 'active' : 'closed'}">${b.status === 'active' ? 'AKTIF' : 'CLOSED'}</span>
                  </div>
                  ${s ? `
                  <div class="grid2" style="background:var(--bg-body); border-radius:6px; padding:8px; margin-bottom:8px;">
                    <div><div class="stat-label" style="font-size:0.7rem">Omzet Proyek (Porsi)</div><div style="font-weight:600;font-size:0.85rem">${rp(s.omzet)}</div></div>
                    <div><div class="stat-label" style="font-size:0.7rem">Profit Bersih (Porsi)</div><div style="font-weight:800;font-size:0.85rem">${rp(s.netProfit)}</div></div>
                    <div>
                      <div class="stat-label" style="font-size:0.7rem">Hak Profit Investor</div>
                      <div style="font-weight:800;font-size:0.85rem;color:var(--primary)">${rp(s.investorShare)}</div>
                    </div>
                    <div>
                      <div class="stat-label" style="font-size:0.7rem">Sisa Belum Cair</div>
                      <div style="font-weight:800;font-size:0.85rem;color:${s.investorShare - (s.withdrawnAmount || 0) > 0 ? 'var(--warning)' : 'var(--success)'}">${rp(s.investorShare - (s.withdrawnAmount || 0))}</div>
                    </div>
                  </div>
                  ${(s.investorShare - (s.withdrawnAmount || 0)) > 0 ? `<button class="btn success full" style="padding:6px;font-size:0.85rem;" onclick="openCairkanModal('${b.id}')"><i class="fas fa-hand-holding-dollar"></i> Cairkan</button>` : `<div class="meta" style="text-align:center;color:var(--success);font-weight:700;"><i class="fas fa-check"></i> Sudah Lunas</div>`}
                  ` : `<div class="meta">Klik "Hitung" untuk lihat omzet & profit.</div>`}
                </div>`;
              }).join('')}
            </div>
          </div>`;
        }).join('');
      })()}
    </div>
    <div class="modal" id="cairkanModal"></div>
  `;
}

window.toggleGroup = function(groupId) {
  const el = document.getElementById(groupId);
  const icon = document.getElementById('icon-' + groupId);
  if (el) {
    if (el.style.display === 'none') {
      el.style.display = 'block';
      if (icon) icon.style.transform = 'rotate(180deg)';
    } else {
      el.style.display = 'none';
      if (icon) icon.style.transform = 'rotate(0deg)';
    }
  }
};

window.refreshStats = async function () {
  setBusy(true);
  try {
    await Promise.all([loadInvestorProducts(), loadProjects(), loadBatches()]);
    await computeAllBatchStats(state.statsRange);
    render();
    toast('Statistik diperbarui');
  } catch (err) {
    console.error(err);
    toast('Gagal menghitung statistik', true);
  } finally {
    setBusy(false);
  }
};

function renderInvestors() {
  const pending = state.investors.filter(i => i.pin === 'PENDING');
  const active = state.investors.filter(i => i.pin !== 'PENDING');

  let inboxHtml = '';
  if (pending.length > 0) {
    inboxHtml = `
      <div style="background:#FFF3CD; border:1px solid #FFE69C; padding:12px; border-radius:8px; margin-bottom:16px;">
        <div style="font-weight:800; color:#856404; margin-bottom:8px;"><i class="fas fa-inbox"></i> ${pending.length} Permintaan Pendaftaran</div>
        ${pending.map(i => `
          <div style="background:#FFF; padding:10px; border-radius:6px; border:1px solid #FFE69C; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-weight:700;">${esc(i.name)}</div>
              <div style="font-size:0.8rem; color:var(--text-muted);">${esc(i.phone)}</div>
            </div>
            <div style="display:flex;gap:4px">
              <button class="btn sm success" onclick="openInvestorFormModal('${i.id}')">Setujui</button>
              <button class="btn sm err" onclick="deleteInvestor('${i.id}','${(i.name||'').replace(/'/g,"\\'")}')"><i class="fas fa-times"></i></button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  return `
    ${header('Investor', 'Kelola data investor')}
    <div class="content">
      ${inboxHtml}
      <button class="btn primary full mb" onclick="openInvestorFormModal()"><i class="fas fa-plus"></i> Tambah Investor</button>
      ${active.length ? active.map(i => `
        <div class="card pad mb">
          <div class="row">
            <div>
              <div class="title">${esc(i.name)}</div>
              <div class="meta">${esc(i.phone || '-')}</div>
            </div>
            <div style="display:flex;gap:6px">
              <button class="btn" onclick="openInvestorFormModal('${i.id}')"><i class="fas fa-pen"></i></button>
              <button class="btn red" onclick="deleteInvestor('${i.id}','${(i.name||'').replace(/'/g,"\\'")}')"><i class="fas fa-trash"></i></button>
            </div>
          </div>
        </div>
      `).join('') : `<div class="empty">Belum ada investor aktif.</div>`}
    </div>
    <div class="modal" id="investorFormModal"></div>
  `;
}

function renderProjects() {
  return `
    ${header('Master Proyek', 'Kelola daftar proyek')}
    <div class="content">
      <button class="btn primary full mb" onclick="openProjectFormModal()"><i class="fas fa-plus"></i> Tambah Proyek</button>
      ${state.projects.length ? state.projects.map(p => `
        <div class="card pad mb">
          <div class="row">
            <div>
              <div class="title">${esc(p.name)}</div>
              ${p.target_amount ? `<div class="meta" style="color:var(--primary); font-weight:600">Target Maksimal: ${rp(p.target_amount)}</div>` : '<div class="meta">Tanpa batas maksimal</div>'}
            </div>
            <span class="chip ${p.status === 'active' ? 'active' : 'closed'}">${p.status === 'active' ? 'AKTIF' : 'CLOSED'}</span>
          </div>
          <div style="display:flex;gap:6px;margin-top:10px">
            <button class="btn" style="flex:1" onclick="openProjectFormModal('${p.id}')"><i class="fas fa-pen"></i> Edit</button>
            <button class="btn red" style="flex:1" onclick="deleteProject('${p.id}','${(p.name||'').replace(/'/g,"\\'")}')"><i class="fas fa-trash"></i> Hapus</button>
          </div>
        </div>
      `).join('') : `<div class="empty">Belum ada proyek.</div>`}
    </div>
    <div class="modal" id="projectFormModal"></div>
  `;
}

function renderBatches() {
  return `
    ${header('Batch Investasi', 'Kelola batch dana investor')}
    <div class="content">
      <button class="btn primary full mb" onclick="openBatchFormModal()"><i class="fas fa-plus"></i> Tambah Batch</button>
      ${state.batches.length ? state.batches.map(b => `
        <div class="card pad mb">
          <div class="row">
            <div>
              <div class="title">${esc(b.batch_name)}</div>
              <div class="meta">${esc(b.investors?.name || '-')} · Modal ${rp(b.amount_invested)}</div>
              ${b.target_amount ? `<div class="meta" style="color:var(--primary); font-weight:600">Target Proyek: ${rp(b.target_amount)}</div>` : ''}
            </div>
            <span class="chip ${b.status === 'active' ? 'active' : 'closed'}">${b.status === 'active' ? 'AKTIF' : 'CLOSED'}</span>
          </div>
          <div style="display:flex;gap:6px;margin-top:10px">
            <button class="btn green" style="flex:1" onclick="openManualProfitModal('${b.id}', '${(b.investors?.name||'').replace(/'/g,"\\'").trim()}', '${(b.batch_name||'').replace(/'/g,"\\'").trim()}')"><i class="fas fa-plus"></i> Profit</button>
            <button class="btn" style="flex:1" onclick="openBatchFormModal('${b.id}')"><i class="fas fa-pen"></i> Edit</button>
            <button class="btn red" style="flex:1" onclick="deleteBatch('${b.id}','${(b.batch_name||'').replace(/'/g,"\\'")}')"><i class="fas fa-trash"></i> Hapus</button>
          </div>
        </div>
      `).join('') : `<div class="empty">Belum ada batch.</div>`}
    </div>
    <div class="modal" id="batchFormModal"></div>
  `;
}

function renderDistribution() {
  return `
    ${header('Pencairan', 'Riwayat bagi hasil')}
    <div class="content">
      ${state.distributions.length ? state.distributions.map(d => `
        <div class="card pad mb">
          <div class="row">
            <div>
              <div class="title">${esc(d.investment_batches?.batch_name || '-')}</div>
              <div class="meta">${esc(d.investment_batches?.investors?.name || '-')} · Periode ${esc(d.period)}</div>
            </div>
            <span class="chip ${d.paid_to_investor ? 'active' : 'closed'}">${d.paid_to_investor ? 'SUDAH CAIR' : 'PENDING'}</span>
          </div>
          <div class="sep"></div>
          <div class="grid2">
            <div><div class="stat-label">Profit Bersih</div><div style="font-weight:800">${rp(d.net_profit)}</div></div>
            <div><div class="stat-label">Bagian Investor</div><div style="font-weight:800;color:var(--primary)">${rp(d.investor_share_amount)}</div></div>
          </div>
          <div style="display:flex; gap:8px; margin-top:10px">
            ${!d.paid_to_investor ? `<button class="btn success" style="flex:1" onclick="markPaid('${d.id}')"><i class="fas fa-check"></i> Sudah Dicairkan</button>` : ''}
            <button class="btn danger" style="flex:${d.paid_to_investor ? '1' : '0 0 auto'}; padding:0 1rem; border-color:rgba(255,100,100,0.3)" onclick="deleteDistribution('${d.id}')" title="Batalkan/Hapus Pencairan"><i class="fas fa-trash"></i>${d.paid_to_investor ? ' Hapus Riwayat' : ' Batal'}</button>
          </div>
        </div>
      `).join('') : `<div class="empty">Belum ada histori pencairan.</div>`}
    </div>
  `;
}

function renderPengaturan() {
  const adminData = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}');
  const isFallback = adminData.is_fallback;
  
  return `
    ${header('Pengaturan', 'Ubah kredensial admin')}
    <div class="content">
      ${isFallback ? `
        <div class="card pad mb" style="border-left: 4px solid var(--warning)">
          <div style="color:var(--warning); font-weight:bold; margin-bottom:8px"><i class="fas fa-exclamation-triangle"></i> Perhatian</div>
          <p style="font-size:0.875rem">Tabel <strong>admin_users</strong> belum dibuat di Supabase. Anda login menggunakan kredensial bawaan. Silakan jalankan kode SQL untuk membuat tabel terlebih dahulu agar bisa mengubah Username/PIN.</p>
        </div>
      ` : ''}
      
      <div class="card pad mb">
        <h3 class="mb">Ubah Username & PIN</h3>
        <div class="form-group">
          <label>Username Baru</label>
          <input type="text" id="newAdminUser" class="input" placeholder="Masukkan username baru" value="${adminData.username || ''}" ${isFallback ? 'disabled' : ''}>
        </div>
        <div class="form-group">
          <label>PIN Baru (Angka)</label>
          <input type="number" pattern="[0-9]*" inputmode="numeric" id="newAdminPin" class="input" placeholder="Masukkan PIN baru" value="${adminData.pin || ''}" ${isFallback ? 'disabled' : ''}>
        </div>
        <button class="btn success full mt" onclick="updateAdminCredentials('${adminData.id}')" ${isFallback ? 'disabled' : ''}><i class="fas fa-save"></i> Simpan Perubahan</button>
      </div>
    </div>
  `;
}

window.updateAdminCredentials = async function(id) {
  if (id === 'fallback') return;
  const username = ($('newAdminUser')?.value || '').trim();
  const pin = ($('newAdminPin')?.value || '').trim();
  
  if (!username || !pin) return toast('Username dan PIN tidak boleh kosong', true);
  
  const confirmPin = prompt('Masukkan PIN lama untuk verifikasi:');
  const adminData = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}');
  if (String(confirmPin) !== String(adminData.pin)) return toast('PIN salah!', true);
  
  setBusy(true);
  try {
    const { error } = await sb.from('admin_users').update({ username, pin }).eq('id', id);
    if (error) throw error;
    
    // Update session
    adminData.username = username;
    adminData.pin = pin;
    localStorage.setItem(SESSION_KEY, JSON.stringify(adminData));
    
    toast('Kredensial berhasil diubah!');
  } catch(err) {
    console.error(err);
    toast('Gagal mengubah kredensial', true);
  } finally {
    setBusy(false);
  }
};

// ============ MODALS: INVESTOR ============
window.openInvestorFormModal = function (id) {
  const inv = id ? state.investors.find(x => String(x.id) === String(id)) : null;
  const modal = $('investorFormModal');
  modal.innerHTML = `
    <div class="sheet">
      <div class="sheetHead">
        <div><div class="title">${inv ? 'Edit' : 'Tambah'} Investor</div></div>
        <button class="btn" onclick="closeModal('investorFormModal')"><i class="fas fa-xmark"></i></button>
      </div>
      <div class="tiny">Nama</div>
      <input id="invName" class="input" style="margin-top:6px;margin-bottom:10px" value="${esc(inv?.name || '')}" placeholder="Nama investor">
      <div class="tiny">No. HP</div>
      <input id="invPhone" class="input" style="margin-top:6px;margin-bottom:10px" value="${esc(inv?.phone || '')}" placeholder="08xxxxxxxxxx">
      <div class="tiny">PIN Login Investor (4-6 digit)</div>
      <input id="invPin" class="input" style="margin-top:6px;margin-bottom:14px" type="text" inputmode="numeric" value="${esc(inv?.pin === 'PENDING' ? '' : (inv?.pin || ''))}" placeholder="misal 2468">
      <button class="btn primary full" onclick="saveInvestor(${inv ? `'${inv.id}'` : 'null'})"><i class="fas fa-check"></i> Simpan</button>
    </div>`;
  modal.className = 'modal show';
};
window.saveInvestor = async function (id) {
  const name = $('invName').value.trim();
  const phone = $('invPhone').value.trim();
  const pin = $('invPin').value.trim();
  if (!name) return toast('Nama wajib diisi', true);
  if (!pin) return toast('PIN wajib diisi', true);
  setBusy(true);
  try {
    if (id) {
      const { error } = await sb.from('investors').update({ name, phone, pin }).eq('id', id);
      if (error) throw error;
    } else {
      const { error } = await sb.from('investors').insert([{ name, phone, pin }]);
      if (error) throw error;
    }
    closeModal('investorFormModal');
    await loadInvestors();
    render();
    toast('Investor disimpan');
  } catch (err) {
    console.error(err);
    toast('Gagal menyimpan investor', true);
  } finally {
    setBusy(false);
  }
};
window.deleteInvestor = async function (id, name) {
  if (!confirm(`Hapus investor "${name}"? Semua batch terkait ikut terhapus.`)) return;
  setBusy(true);
  try {
    const { error } = await sb.from('investors').delete().eq('id', id);
    if (error) throw error;
    await Promise.all([loadInvestors(), loadBatches()]);
    render();
    toast('Investor dihapus');
  } catch (err) {
    console.error(err);
    toast('Gagal menghapus investor', true);
  } finally {
    setBusy(false);
  }
};

// ============ MODALS: PROJECT ============
window.openProjectFormModal = function (id) {
  const p = id ? state.projects.find(x => String(x.id) === String(id)) : null;
  const modal = $('projectFormModal');
  modal.innerHTML = `
    <div class="sheet">
      <div class="sheetHead">
        <div><div class="title">${p ? 'Edit' : 'Tambah'} Proyek</div></div>
        <button class="btn" onclick="closeModal('projectFormModal')"><i class="fas fa-xmark"></i></button>
      </div>
      <div class="tiny">Nama Proyek (Batch)</div>
      <input id="projectName" class="input" style="margin-top:6px;margin-bottom:10px" value="${esc(p?.name || '')}" placeholder="misal Modal Hijab Segiempat">
      
      <div class="tiny">Target Maksimal Dana Proyek (Rp)</div>
      <input id="projectTargetAmount" class="input" style="margin-top:6px;margin-bottom:10px" type="text" inputmode="numeric" onkeyup="formatRupiahInput(this)" value="${p?.target_amount ? parseInt(p.target_amount, 10).toLocaleString('id-ID') : ''}" placeholder="Kosongkan jika tidak ada batas">
      
      <div class="tiny">Status</div>
      <select id="projectStatus" class="input" style="margin-top:6px;margin-bottom:14px">
        <option value="active" ${p?.status !== 'closed' ? 'selected' : ''}>Aktif</option>
        <option value="closed" ${p?.status === 'closed' ? 'selected' : ''}>Closed</option>
      </select>
      <button class="btn primary full" onclick="saveProject(${p ? `'${p.id}'` : 'null'})"><i class="fas fa-check"></i> Simpan</button>
    </div>`;
  modal.className = 'modal show';
};

window.saveProject = async function (id) {
  const name = $('projectName').value.trim();
  const target_amount = parseRupiahInput($('projectTargetAmount').value) || null;
  const status = $('projectStatus').value;
  if (!name) return toast('Nama proyek wajib diisi', true);
  
  setBusy(true);
  try {
    if (id) {
      const { error } = await sb.from('projects').update({ name, target_amount, status }).eq('id', id);
      if (error) throw error;
    } else {
      const { error } = await sb.from('projects').insert([{ name, target_amount, status }]);
      if (error) throw error;
      
      // Auto-create in investment_batch_catalog
      const pricePerLot = 200000; // Default 200rb
      const maxLots = target_amount ? Math.floor(target_amount / pricePerLot) : 0;
      await sb.from('investment_batch_catalog').insert([{
        batch_name: name,
        description: name,
        total_target: target_amount || 0,
        price_per_lot: pricePerLot,
        max_lots: maxLots,
        status: status === 'active' ? 'open' : 'closed',
        active_month: 'TBA'
      }]);
    }
    closeModal('projectFormModal');
    await loadProjects();
    await loadCatalog(); // Refresh catalog state too
    render();
    toast('Proyek disimpan');
  } catch (err) {
    console.error(err);
    toast('Error: ' + (err.message || 'Gagal menyimpan'), true);
  } finally {
    setBusy(false);
  }
};

window.deleteProject = async function (id, name) {
  if (!confirm(`Hapus proyek "${name}"? Ini tidak menghapus batch investasi di dalamnya.`)) return;
  setBusy(true);
  try {
    const { error } = await sb.from('projects').delete().eq('id', id);
    if (error) throw error;
    await loadProjects();
    render();
    toast('Proyek dihapus');
  } catch (err) {
    console.error(err);
    toast('Gagal menghapus proyek', true);
  } finally {
    setBusy(false);
  }
};

// ============ MODALS: BATCH ============
window.openBatchFormModal = function (id) {
  const b = id ? state.batches.find(x => String(x.id) === String(id)) : null;
  const modal = $('batchFormModal');
  modal.innerHTML = `
    <div class="sheet">
      <div class="sheetHead">
        <div><div class="title">${b ? 'Edit' : 'Tambah'} Batch Investasi</div></div>
        <button class="btn" onclick="closeModal('batchFormModal')"><i class="fas fa-xmark"></i></button>
      </div>
      <div class="tiny">Investor</div>
      <select id="batchInvestor" class="input" style="margin-top:6px;margin-bottom:10px">
        ${state.investors.map(i => `<option value="${i.id}" ${b?.investor_id === i.id ? 'selected' : ''}>${esc(i.name)}</option>`).join('') || '<option value="">Belum ada investor</option>'}
      </select>
      <div class="tiny">Proyek / Master Batch</div>
      <select id="batchName" class="input" style="margin-top:6px;margin-bottom:10px">
        ${state.projects.map(p => `<option value="${esc(p.name)}" ${b?.batch_name === p.name ? 'selected' : ''}>${esc(p.name)}</option>`).join('') || '<option value="">Belum ada master proyek</option>'}
      </select>
      <div class="tiny">Jumlah Lot (Kosongi jika tidak ingin memotong sisa lot katalog)</div>
      <input id="batchLots" class="input" style="margin-top:6px;margin-bottom:10px" type="number" min="0" value="0" onchange="autoCalculateAmount()">
      
      <div class="tiny">Dana Diinvestasikan Oleh Investor Ini (Rp)</div>
      <input id="batchAmount" class="input" style="margin-top:6px;margin-bottom:10px" type="text" inputmode="numeric" onkeyup="formatRupiahInput(this)" value="${b?.amount_invested ? parseInt(b.amount_invested, 10).toLocaleString('id-ID') : ''}" placeholder="10.000.000">
      <div class="tiny">Tanggal Aktif (Kosong = Otomatis Bulan Depan)</div>
      <input id="batchStartDate" class="input" style="margin-top:6px;margin-bottom:10px" type="date" value="${b?.start_date || ''}">
      <div class="tiny">Status</div>
      <select id="batchStatus" class="input" style="margin-top:6px;margin-bottom:14px">
        <option value="active" ${b?.status !== 'closed' ? 'selected' : ''}>Aktif</option>
        <option value="closed" ${b?.status === 'closed' ? 'selected' : ''}>Closed</option>
      </select>
      <button class="btn primary full" onclick="saveBatch(${b ? `'${b.id}'` : 'null'})"><i class="fas fa-check"></i> Simpan</button>
    </div>`;
  modal.className = 'modal show';
};

window.autoCalculateAmount = function() {
  const lots = Number($('batchLots').value) || 0;
  const batchName = $('batchName').value;
  if (!lots || !batchName) return;
  const catalog = state.catalog.find(c => c.batch_name.trim().toLowerCase() === batchName.trim().toLowerCase());
  if (catalog && catalog.price_per_lot) {
    const total = lots * Number(catalog.price_per_lot);
    $('batchAmount').value = total.toLocaleString('id-ID');
  }
};

window.saveBatch = async function (id) {
  const investor_id = $('batchInvestor').value;
  const batch_name = $('batchName').value;
  const amount_invested = parseRupiahInput($('batchAmount').value) || 0;
  const status = $('batchStatus').value;
  let start_date = $('batchStartDate').value;
  const inputLots = Number($('batchLots').value) || 0;
  
  if (!investor_id) return toast('Pilih investor dulu (tambah investor kalau belum ada)', true);
  if (!batch_name) return toast('Pilih master proyek dulu', true);

  // Get target_amount from master projects
  const proj = state.projects.find(p => p.name === batch_name);
  const target_amount = proj ? Number(proj.target_amount || 0) : 0;

  if (target_amount && target_amount > 0 && status === 'active') {
    const pName = batch_name.toLowerCase();
    const otherBatches = state.batches.filter(b => b.batch_name.trim().toLowerCase() === pName && b.status === 'active' && String(b.id) !== String(id));
    const totalExisting = otherBatches.reduce((acc, b) => acc + Number(b.amount_invested || 0), 0);
    const newTotal = totalExisting + amount_invested;
    if (newTotal > target_amount) {
      return toast(`Dana kepenuhan! Sisa slot maksimal proyek ini: Rp ${target_amount - totalExisting}`, true);
    }
  }

  if (!start_date) {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    start_date = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01';
  }

  setBusy(true);
  try {
    if (id) {
      const { error } = await sb.from('investment_batches').update({ investor_id, batch_name, amount_invested, target_amount, status, start_date }).eq('id', id);
      if (error) throw error;
    } else {
      const { error } = await sb.from('investment_batches').insert([{ investor_id, batch_name, amount_invested, target_amount, status, start_date }]);
      if (error) throw error;
      
      // Update catalog lots_sold if lots > 0
      if (inputLots > 0) {
        const catalog = state.catalog.find(c => c.batch_name.trim().toLowerCase() === batch_name.trim().toLowerCase());
        if (catalog) {
          const newLotsSold = (Number(catalog.lots_sold) || 0) + inputLots;
          await sb.from('investment_batch_catalog').update({ lots_sold: newLotsSold }).eq('id', catalog.id);
        }
      }
    }
    closeModal('batchFormModal');
    await loadBatches();
    render();
    toast('Batch disimpan');
  } catch (err) {
    console.error(err);
    toast('Gagal menyimpan batch', true);
  } finally {
    setBusy(false);
  }
};
window.deleteBatch = async function (id, name) {
  if (!confirm(`Hapus batch "${name}"? Produk yang terhubung batch ini jadi tidak terhubung.`)) return;
  setBusy(true);
  try {
    const { error } = await sb.from('investment_batches').delete().eq('id', id);
    if (error) throw error;
    await loadBatches();
    render();
    toast('Batch dihapus');
  } catch (err) {
    console.error(err);
    toast('Gagal menghapus batch', true);
  } finally {
    setBusy(false);
  }
};

window.openManualProfitModal = function (batchId, investorName, batchName) {
  const modal = $('batchFormModal');
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>Tambah Profit Manual</h2>
        <button class="close-btn" onclick="closeModal('batchFormModal')"><i class="fas fa-times"></i></button>
      </div>
      <div class="modal-body">
        <p>Investor: <b>${esc(investorName)}</b></p>
        <p>Proyek: <b>${esc(batchName)}</b></p>
        <br/>
        <div class="form-group">
          <label>Aksi</label>
          <select id="manualProfitAction" class="input" style="margin-top:6px;margin-bottom:10px">
            <option value="add">Tambah Profit (+)</option>
            <option value="subtract">Kurangi Profit (-)</option>
          </select>
        </div>
        <div class="form-group">
          <label>Nominal (Rp)</label>
          <input type="text" id="manualProfitAmount" class="input rupiah-input" placeholder="Contoh: 50.000" onkeyup="formatRupiahInput(this)">
        </div>
        <button class="btn primary full" onclick="saveManualProfit('${batchId}')"><i class="fas fa-check"></i> Simpan Manual Profit</button>
      </div>
    </div>`;
  modal.className = 'modal show';
};

window.saveManualProfit = async function (batchId) {
  const rawAmount = parseRupiahInput($('manualProfitAmount').value) || 0;
  if (rawAmount <= 0) return toast('Masukkan nominal yang valid', true);
  const action = $('manualProfitAction').value;
  const amount = action === 'subtract' ? -rawAmount : rawAmount;

  setBusy(true);
  try {
    const payload = {
      id: 'man_prof_' + Date.now() + '_' + Math.floor(Math.random()*1000),
      data: {
         amount: amount,
         note: `[MANUAL_PROFIT] BATCH_ID=${batchId} AMOUNT=${amount}`,
         monthKey: new Date().toISOString().substring(0, 7),
         dateKey: new Date().toISOString(),
         deleted: false
      }
    };
    const { error } = await sb.from('transactions').insert([payload]);
    if (error) throw error;
    
    closeModal('batchFormModal');
    toast('Profit manual ditambahkan!');
    await computeAllBatchStats(state.statsRange);
    render();
  } catch (err) {
    console.error(err);
    toast('Gagal menambah profit manual', true);
  } finally {
    setBusy(false);
  }
};

// ============ MODAL: CAIRKAN BAGI HASIL ============
window.openCairkanModal = function (batchId) {
  const s = state.batchStats[batchId];
  const b = state.batches.find(x => String(x.id) === String(batchId));
  if (!s || !b) return;
  const unwithdrawn = s.investorShare - (s.withdrawnAmount || 0);
  if (unwithdrawn <= 0) return toast('Tidak ada sisa profit yang bisa dicairkan', true);

  const modal = $('cairkanModal');
  modal.innerHTML = `
    <div class="sheet">
      <div class="sheetHead">
        <div><div class="title">Cairkan Bagi Hasil</div><div class="meta">${esc(b.batch_name)}</div></div>
        <button class="btn" onclick="closeModal('cairkanModal')"><i class="fas fa-xmark"></i></button>
      </div>
      <div class="card pad mb" style="background:var(--primary-soft)">
        <div class="grid2">
          <div><div class="stat-label">Total Bagian Investor</div><div style="font-weight:800">${rp(s.investorShare)}</div></div>
          <div><div class="stat-label">Sisa Belum Cair</div><div style="font-weight:800;color:var(--warning)">${rp(unwithdrawn)}</div></div>
        </div>
      </div>
      <div class="tiny">Nominal Pencairan</div>
      <input id="distAmount" type="number" class="input" style="margin-top:6px;margin-bottom:10px; font-weight:bold" value="${Math.floor(unwithdrawn)}" max="${unwithdrawn}">
      <div class="tiny">Periode</div>
      <input id="distPeriod" class="input" style="margin-top:6px;margin-bottom:10px" value="${monthKey()}" placeholder="2026-08">
      <div class="tiny">Catatan (opsional)</div>
      <input id="distNote" class="input" style="margin-top:6px;margin-bottom:14px" placeholder="misal transfer via BCA">
      <button class="btn success full" onclick="confirmCairkan('${batchId}')"><i class="fas fa-check"></i> Simpan Pencairan</button>
    </div>`;
  modal.className = 'modal show';
};
window.confirmCairkan = async function (batchId) {
  const s = state.batchStats[batchId];
  const period = $('distPeriod').value.trim() || monthKey();
  const note = $('distNote').value.trim();
  const amount = Number($('distAmount').value);
  const unwithdrawn = s.investorShare - (s.withdrawnAmount || 0);
  
  if (!amount || amount <= 0 || amount > unwithdrawn) {
    return toast('Nominal pencairan tidak valid', true);
  }

  const pin = prompt('Masukkan PIN admin untuk konfirmasi:');
  if (pin === null) return;
  const adminData = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}');
  const expectedPin = adminData.pin || String(ADMIN_PIN);
  if (String(pin) !== String(expectedPin)) return toast('PIN salah', true);
  setBusy(true);
  try {
    const payload = {
      batch_id: batchId,
      period,
      gross_revenue: s.omzet,
      total_modal: s.modal,
      net_profit: s.netProfit,
      owner_share_amount: s.ownerShare,
      investor_share_amount: amount,
      paid_to_investor: false,
      note,
    };
    const { error } = await sb.from('profit_distributions').insert([payload]);
    if (error) throw error;
    closeModal('cairkanModal');
    await loadDistributions();
    toast('Pencairan dicatat. Cek tab Pencairan untuk tandai sudah dibayar.');
    go('distribution');
  } catch (err) {
    console.error(err);
    toast('Gagal mencatat pencairan', true);
  } finally {
    setBusy(false);
  }
};
window.markPaid = async function (id) {
  if (!confirm('Tandai pencairan ini sudah dibayar ke investor?')) return;
  setBusy(true);
  try {
    const { error } = await sb.from('profit_distributions').update({ paid_to_investor: true, paid_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
    await loadDistributions();
    render();
    toast('Ditandai sudah dicairkan');
  } catch (err) {
    console.error(err);
    toast('Gagal update status', true);
  } finally {
    setBusy(false);
  }
};

window.deleteDistribution = async function (id) {
  if (!confirm('Yakin ingin membatalkan / menghapus pencairan ini? Saldo akan kembali seperti semula.')) return;
  const pin = prompt('Masukkan PIN admin untuk konfirmasi:');
  if (pin === null) return;
  const adminData = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}');
  const expectedPin = adminData.pin || String(ADMIN_PIN);
  if (String(pin) !== String(expectedPin)) return toast('PIN salah', true);
  
  setBusy(true);
  try {
    const { error } = await sb.from('profit_distributions').delete().eq('id', id);
    if (error) throw error;
    await loadDistributions();
    
    // Karena kita menghapus pencairan, kita perlu mengkalkulasi ulang finalStats 
    // agar 'Sisa Belum Cair' di tab Dashboard juga terupdate (withdrawnAmount berkurang).
    await computeAllBatchStats(state.statsRange);
    
    render();
    toast('Pencairan berhasil dihapus');
  } catch (err) {
    console.error(err);
    toast('Gagal menghapus pencairan', true);
  } finally {
    setBusy(false);
  }
};

window.closeModal = function (id) {
  const modal = $(id);
  if (modal) modal.className = 'modal';
};

// ============ BOOT ============
async function boot() {
  $('app').innerHTML = '';
  setBusy(true);
  try {
    await Promise.all([loadInvestors(), loadProjects(), loadBatches(), loadInvestorProducts(), loadDistributions(), loadCatalog(), loadPurchases()]);
    
    // ONE-TIME FIX: Set start_date for batches created recently (August 2026 onwards) that are missing it
    let needsRefetch = false;
    for (const b of state.batches) {
      if (!b.start_date && new Date(b.created_at).getTime() >= new Date('2026-08-01').getTime()) {
        const d = new Date(b.created_at);
        d.setMonth(d.getMonth() + 1);
        const start_date = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01';
        await sb.from('investment_batches').update({ start_date }).eq('id', b.id);
        needsRefetch = true;
      }
    }
    if (needsRefetch) await loadBatches();

    await computeAllBatchStats(state.statsRange);
  } catch (err) {
    console.error(err);
    toast('Gagal memuat data awal', true);
  } finally {
    setBusy(false);
  }
  render();
}

if (localStorage.getItem(SESSION_KEY)) {
  boot();
} else {
  renderPinScreen();
}

// ============================================================
// LOT MANAGEMENT - CATALOG & PURCHASE APPROVAL
// ============================================================

async function loadCatalog() {
  const { data, error } = await sb.from('investment_batch_catalog')
    .select('*').order('created_at', { ascending: false });
  if (!error) state.catalog = data || [];
}

async function loadPurchases() {
  try {
    const yesterday = new Date();
    yesterday.setHours(0,0,0,0);
    await sb.from('investment_purchases')
      .delete()
      .in('payment_status', ['pending', 'failed'])
      .lt('created_at', yesterday.toISOString());
  } catch(e) {
    console.warn('Auto cleanup failed', e);
  }

  const { data, error } = await sb
    .from('investment_purchases')
    .select('*, investors(name, phone), investment_batch_catalog(batch_name, price_per_lot, active_month)')
    .order('created_at', { ascending: false })
    .limit(100);
  if (!error) {
    state.purchases = data || [];
  }
}

function renderLotManagement() {
  const catalog = state.catalog || [];
  const purchases = state.purchases || [];
  const pendingPurchases = purchases.filter(p => p.payment_status === 'paid' && p.approval_status === 'waiting');

  const catalogRows = catalog.map(c => `
    <tr style="border-bottom: 1px solid var(--border);">
      <td style="padding:12px 8px;font-weight:800;">${esc(c.batch_name)}</td>
      <td style="padding:12px 8px;text-align:right;">${rp(c.price_per_lot)}</td>
      <td style="padding:12px 8px;text-align:center;">${c.lots_sold} / ${c.max_lots}</td>
      <td style="padding:12px 8px;text-align:center;"><span class="badge ${c.status === 'open' ? 'success' : c.status === 'full' ? 'pending' : 'err'}">${c.status.toUpperCase()}</span></td>
      <td style="padding:12px 8px;display:flex;gap:6px;justify-content:center;align-items:center;">
        <button class="btn sm" onclick="editCatalog('${c.id}')"><i class="fas fa-pen"></i></button>
        <button class="btn sm err" onclick="deleteCatalog('${c.id}', '${esc(c.batch_name)}')"><i class="fas fa-trash"></i></button>
      </td>
    </tr>`).join('');

  const purchaseRows = purchases.map(p => {
    const statusColor = { paid: '#059669', pending: '#D97706', expired: '#6B7280', failed: '#DC2626' }[p.payment_status] || '#6B7280';
    const canApprove = p.payment_status === 'paid' && p.approval_status === 'waiting';
    return `
    <tr style="border-bottom: 1px solid var(--border);">
      <td style="padding:12px 8px;font-weight:800;">${esc(p.investors?.name || '-')}</td>
      <td style="padding:12px 8px;">${esc(p.investment_batch_catalog?.batch_name || '-')}</td>
      <td style="padding:12px 8px;text-align:right;">${p.lots} lot<br><small style="color:var(--text-muted)">${rp(p.amount)}</small></td>
      <td style="padding:12px 8px;text-align:center;"><span style="color:${statusColor};font-weight:700;">${p.payment_status.toUpperCase()}</span></td>
      <td style="padding:12px 8px;text-align:center;"><span class="badge ${p.approval_status === 'approved' ? 'success' : p.approval_status === 'rejected' ? 'err' : 'pending'}">${p.approval_status === 'approved' ? 'DISETUJUI' : p.approval_status === 'rejected' ? 'DITOLAK' : 'MENUNGGU'}</span></td>
      <td style="padding:12px 8px;text-align:center;">${new Date(p.created_at).toLocaleDateString('id-ID')}</td>
      <td style="padding:12px 8px;display:flex;gap:4px;justify-content:center;align-items:center;">
        ${canApprove ? `
          <button class="btn sm success" onclick="approvePurchase('${p.id}', '${p.investor_id}', '${p.catalog_id}', ${p.lots}, ${p.amount})"><i class="fas fa-check"></i> Setuju</button>
          <button class="btn sm err" onclick="rejectPurchase('${p.id}')"><i class="fas fa-times"></i></button>
        ` : `
          <button class="btn sm err" onclick="deletePurchase('${p.id}')" title="Hapus"><i class="fas fa-trash"></i></button>
        `}
      </td>
    </tr>`;
  }).join('');

  return `
    ${header('Lot & Pembelian', `${pendingPurchases.length} menunggu persetujuan`)}
    <div class="content">
      ${pendingPurchases.length > 0 ? `
      <div class="card" style="border-left:4px solid #D97706;margin-bottom:16px;">
        <div style="font-weight:800;color:#D97706;"><i class="fas fa-bell"></i> ${pendingPurchases.length} Pembelian Menunggu Persetujuan</div>
        <div style="font-size:0.85rem;margin-top:4px;">Investor sudah bayar, silakan review dan setujui di tabel bawah.</div>
      </div>` : ''}

      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
        <h3 style="margin:0;"><i class="fas fa-list-ul"></i> Katalog Batch Aktif</h3>
        <button class="btn primary sm" onclick="openCatalogForm()"><i class="fas fa-plus"></i> Tambah Batch</button>
      </div>
      <div class="card" style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:0.9rem;">
        <thead><tr style="background:var(--bg-body); border-bottom: 2px solid var(--border);">
          <th style="padding:12px 8px;text-align:left;">Batch</th>
          <th style="padding:12px 8px;text-align:right;">Harga/Lot</th>
          <th style="padding:12px 8px;text-align:center;">Lot Terjual</th>
          <th style="padding:12px 8px;text-align:center;">Status</th>
          <th style="padding:12px 8px;text-align:center;">Aksi</th>
        </tr></thead>
        <tbody>${catalogRows || '<tr><td colspan="5" style="text-align:center;padding:16px;color:var(--text-muted);">Belum ada katalog</td></tr>'}</tbody>
      </table></div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin:2rem 0 1rem 0;">
        <h3 style="margin:0;"><i class="fas fa-receipt"></i> Riwayat Pembelian Investor</h3>
        <button class="btn sm err" onclick="deleteAllPendingPurchases()"><i class="fas fa-trash-alt"></i> Bersihkan Semua Riwayat Gagal/Pending</button>
        <button class="btn sm" onclick="refreshLotMgmt()"><i class="fas fa-refresh"></i></button>
      </div>
      <div class="card" style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:0.9rem;">
        <thead><tr style="background:var(--bg-body); border-bottom: 2px solid var(--border);">
          <th style="padding:12px 8px;text-align:left;">Investor</th>
          <th style="padding:12px 8px;text-align:left;">Batch</th>
          <th style="padding:12px 8px;text-align:right;">Lot</th>
          <th style="padding:12px 8px;text-align:center;">Bayar</th>
          <th style="padding:12px 8px;text-align:center;">Approval</th>
          <th style="padding:12px 8px;text-align:center;">Tanggal</th>
          <th style="padding:12px 8px;text-align:center;">Aksi</th>
        </tr></thead>
        <tbody>${purchaseRows || '<tr><td colspan="7" style="text-align:center;padding:16px;color:var(--text-muted);">Belum ada pembelian</td></tr>'}</tbody>
      </table></div>
    </div>

    <!-- Modal Catalog Form -->
    <div id="catalogModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1000;padding:20px;overflow-y:auto;">
      <div style="background:#fff;border-radius:16px;padding:20px;max-width:400px;margin:0 auto;">
        <h3 id="catalogModalTitle" style="margin-bottom:16px;">Tambah Batch Katalog</h3>
        <input type="hidden" id="catalogId">
        <div style="margin-bottom:10px;"><label style="font-size:0.85rem;font-weight:700;">Nama Batch</label>
          <input type="text" id="cBatchName" class="input" placeholder="e.g. PARIS"></div>
        <div style="margin-bottom:10px;"><label style="font-size:0.85rem;font-weight:700;">Deskripsi</label>
          <input type="text" id="cDesc" class="input" placeholder="Opsional"></div>
        <div style="margin-bottom:10px;"><label style="font-size:0.85rem;font-weight:700;">Total Target Dana (Rp)</label>
          <input type="number" id="cTarget" class="input" placeholder="10000000" min="0"></div>
        <div style="margin-bottom:10px;"><label style="font-size:0.85rem;font-weight:700;">Harga per Lot (Rp)</label>
          <input type="number" id="cPricePerLot" class="input" placeholder="200000" min="1000"></div>
        <div style="margin-bottom:16px;"><label style="font-size:0.85rem;font-weight:700;">Status</label>
          <select id="cStatus" class="input"><option value="open">Open</option><option value="closed">Closed</option></select></div>
        <div style="display:flex;gap:8px;">
          <button class="btn primary" style="flex:1;" onclick="saveCatalog()">Simpan</button>
          <button class="btn" onclick="closeCatalogModal()">Batal</button>
        </div>
      </div>
    </div>`;
}

window.openCatalogForm = function() {
  $('catalogId').value = '';
  $('cBatchName').value = '';
  $('cDesc').value = '';
  $('cTarget').value = '';
  $('cPricePerLot').value = '';
  $('cStatus').value = 'open';
  $('catalogModalTitle').textContent = 'Tambah Batch Katalog';
  $('catalogModal').style.display = 'block';
};

window.editCatalog = function(id) {
  const c = state.catalog.find(x => x.id === id);
  if (!c) return;
  $('catalogId').value = c.id;
  $('cBatchName').value = c.batch_name;
  $('cDesc').value = c.description || '';
  $('cTarget').value = c.total_target;
  $('cPricePerLot').value = c.price_per_lot;
  $('cStatus').value = c.status;
  $('catalogModalTitle').textContent = 'Edit Batch Katalog';
  $('catalogModal').style.display = 'block';
};

window.closeCatalogModal = function() {
  $('catalogModal').style.display = 'none';
};

window.saveCatalog = async function() {
  const id = $('catalogId').value;
  const batchName = $('cBatchName').value.trim().toUpperCase();
  const description = $('cDesc').value.trim();
  const totalTarget = Number($('cTarget').value) || 0;
  const pricePerLot = Number($('cPricePerLot').value) || 0;
  const status = $('cStatus').value;

  if (!batchName) return toast('Nama batch wajib diisi', true);
  if (pricePerLot <= 0) return toast('Harga per lot harus > 0', true);

  const maxLots = pricePerLot > 0 ? Math.floor(totalTarget / pricePerLot) : 0;
  // Kita isi active_month dengan nilai dummy (TBA) karena sekarang dihitung otomatis per pembeli,
  // tapi database masih mewajibkan kolom ini diisi.
  const payload = { batch_name: batchName, description, total_target: totalTarget, price_per_lot: pricePerLot, max_lots: maxLots, status, active_month: 'TBA' };

  setBusy(true);
  try {
    if (id) {
      const { error } = await sb.from('investment_batch_catalog').update(payload).eq('id', id);
      if (error) throw error;
      
      // Auto-sync update ke tabel projects
      const { data: existingProjs } = await sb.from('projects').select('id').eq('name', batchName);
      if (existingProjs && existingProjs.length > 0) {
        await sb.from('projects').update({ target_amount: totalTarget, status: status === 'open' ? 'active' : 'closed' }).eq('name', batchName);
      } else {
        await sb.from('projects').insert({ name: batchName, target_amount: totalTarget, status: status === 'open' ? 'active' : 'closed' });
      }
      toast('Katalog & Master Proyek diperbarui!');
    } else {
      const { error } = await sb.from('investment_batch_catalog').insert({ ...payload, lots_sold: 0, lots_pending: 0 });
      if (error) throw error;
      
      // Auto-sync ke tabel projects (Master Proyek)
      await sb.from('projects').insert({
        name: batchName,
        target_amount: totalTarget,
        status: status === 'open' ? 'active' : 'closed'
      });
      
      toast('Katalog & Master Proyek ditambahkan!');
    }
    closeCatalogModal();
    await Promise.all([loadCatalog(), loadProjects()]);
    render();
  } catch (e) {
    toast('Gagal simpan: ' + (e.message || e), true);
  } finally {
    setBusy(false);
  }
};

window.deleteCatalog = async function(id, name) {
  if (!confirm(`Hapus katalog "${name}"?`)) return;
  setBusy(true);
  try {
    const { error } = await sb.from('investment_batch_catalog').delete().eq('id', id);
    if (error) throw error;
    toast('Katalog dihapus.');
    await loadCatalog();
    render();
  } catch (e) {
    toast('Gagal hapus: ' + (e.message || e), true);
  } finally {
    setBusy(false);
  }
};

window.approvePurchase = async function(purchaseId, investorId, catalogId, lots, amount) {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const defaultDateStr = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;
  
  const inputDate = prompt(`Setujui pembelian ini?\nBatch akan dibuat otomatis di investment_batches.\n\nKapan modal investor ini akan mulai aktif/dihitung persentasenya? (Format YYYY-MM-DD)`, defaultDateStr);
  if (inputDate === null) return; // User click cancel
  
  const activeMonthStr = inputDate.trim() || defaultDateStr;

  setBusy(true);
  try {
    // Ambil detail katalog
    const catalog = state.catalog.find(c => c.id === catalogId);
    const batchName = catalog?.batch_name || 'Investasi';

    // Buat record di investment_batches
    const { data: newBatch, error: batchErr } = await sb.from('investment_batches').insert({
      investor_id: investorId,
      batch_name: batchName,
      amount_invested: amount,
      status: 'active',
      start_date: activeMonthStr,
    }).select().single();
    if (batchErr) throw batchErr;

    // Update purchase: approved + simpan batch_id
    const { error: updateErr } = await sb.from('investment_purchases').update({
      approval_status: 'approved',
      approved_at: new Date().toISOString(),
      batch_id: newBatch.id,
    }).eq('id', purchaseId);
    if (updateErr) throw updateErr;

    // Update lots_sold di katalog
    await sb.from('investment_batch_catalog').update({
      lots_sold: (catalog?.lots_sold || 0) + lots,
      lots_pending: Math.max(0, (catalog?.lots_pending || 0) - lots),
      status: ((catalog?.lots_sold || 0) + lots) >= (catalog?.max_lots || 0) ? 'full' : 'open',
    }).eq('id', catalogId);

    toast('Pembelian disetujui! Batch investasi dibuat.');
    await Promise.all([loadCatalog(), loadPurchases()]);
    render();
  } catch (e) {
    toast('Gagal approve: ' + (e.message || e), true);
  } finally {
    setBusy(false);
  }
};

window.rejectPurchase = async function(id) {
  if (!confirm('Tolak pembelian ini?')) return;
  setBusy(true);
  try {
    const { error } = await sb.from('investment_purchases').update({ approval_status: 'rejected' }).eq('id', id);
    if (error) throw error;
    await refreshLotMgmt();
    toast('Pembelian ditolak');
  } catch (err) {
    alert(err.message);
  } finally {
    setBusy(false);
  }
};

window.deletePurchase = async function(id) {
  if (!confirm('Yakin ingin menghapus riwayat pembelian ini secara permanen?')) return;
  setBusy(true);
  try {
    const { error } = await sb.from('investment_purchases').delete().eq('id', id);
    if (error) throw error;
    await refreshLotMgmt();
    toast('Riwayat pembelian dihapus');
  } catch (err) {
    alert(err.message);
  } finally {
    setBusy(false);
  }
};

window.deleteAllPendingPurchases = async function() {
  if (!confirm('Yakin ingin menghapus SEMUA riwayat pembelian yang berstatus PENDING atau FAILED secara permanen?')) return;
  setBusy(true);
  try {
    const { error } = await sb.from('investment_purchases').delete().in('payment_status', ['pending', 'failed']);
    if (error) throw error;
    await refreshLotMgmt();
    toast('Semua riwayat pending & gagal telah dibersihkan');
  } catch (err) {
    alert(err.message);
  } finally {
    setBusy(false);
  }
};

window.refreshLotMgmt = async function() {
  setBusy(true);
  await Promise.all([loadCatalog(), loadPurchases()]);
  render();
  setBusy(false);
};
