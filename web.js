// ==========================================
// 1. CONFIGURACIÓN, CONEXIÓN A SUPABASE Y ARRANQUE
// ==========================================
const AUTH = { user: "admin", pass: "admin123", secret: "FARMA777" };

// 🔑 TUS CREDENCIALES DE SUPABASE:
const SUPABASE_URL = "https://aulhwgtakozmsrsnemeu.supabase.co/rest/v1/"; 
const SUPABASE_KEY = "sb_publishable_1Xn5wslEN-hXRjiYOW08Vw_iV1ztkTW"; 

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Memoria virtual: Aquí se guardarán los datos de internet para que tu código funcione rápido
let serverData = {
  f_cats: ['Analgésicos', 'Antibióticos', 'Antiinflamatorios', 'Vitaminas'],
  f_formas: ['Tab', 'Jarabe', 'Ampolla', 'Cápsula'],
  f_prods: [], // Se llenará desde internet
  f_lots: [],  
  f_sales: [],
  f_silenced_alerts: []
};

// 🌟 TU NUEVO OBJETO 'DB' (Ya NO usa LocalStorage)
const DB = {
  get: (key, fallback) => {
    // En lugar de buscar en la laptop, busca en la memoria virtual
    return serverData[key] || fallback;
  },
  set: (key, value) => {
    // Actualiza la memoria virtual
    serverData[key] = value;
    // Nota: Aquí se implementará la subida a Supabase al registrar ventas/ingresos
  }
};

// Función maestra que descarga los productos del servidor al abrir el sistema
async function loadServerData() {
  console.log("Conectando al servidor de Supabase...");
  try {
    let { data, error } = await supabaseClient.from('productos').select('*');
    if (error) throw error;
    
    // Adaptamos las columnas de Supabase al formato que lee tu sistema
    if (data && data.length > 0) {
      serverData.f_prods = data.map(p => ({
        id: p.id,
        desc: p.descrip || p.desc,
        boxUnits: p.box_units,
        blisterUnits: p.blister_units,
        cat: p.cat,
        forma: p.forma,
        barcode: p.barcode,
        cost: p.cost,
        costMode: p.cost_mode,
        priceBox: p.price_box,
        priceUnit: p.price_unit,
        useIgv: p.use_igv,
        stock: p.stock
      }));
    }
    console.log("¡Productos cargados desde internet!", serverData.f_prods);
    
    // Refrescamos la pantalla para mostrar los datos de la nube
    if (typeof initSystem === 'function') initSystem();
    
  } catch (err) {
    console.error("Error al conectar con la base de datos:", err);
  }
}

// Arrancar la conexión en cuanto cargue la página
window.addEventListener('DOMContentLoaded', loadServerData);

// ==========================================
// (FIN DEL BLOQUE 1) - AQUÍ ABAJO DEBE QUEDAR TU "let cart = [];"
// ==========================================

let cart = [];

// Evento de carga de página global
// Evento de carga de página global adaptado a rangos
const originalOnload = window.onload;
window.onload = function() {
  if (originalOnload) originalOnload();
  const todayString = new Date().toISOString().split('T')[0];
  
  const startEl = document.getElementById('search-sale-start-date');
  const endEl = document.getElementById('search-sale-end-date');
  const historyDateEl = document.getElementById('search-sale-date');
  
  if (startEl && endEl) {
    startEl.value = todayString;
    endEl.value = todayString;
    renderSalesHistory(); 
  } else if (historyDateEl) {
    historyDateEl.value = todayString;
    renderSalesHistory();
  }
};

// Cierre automático de buscadores flotantes si haces clic afuera
document.addEventListener('click', function(e) {
  const posBox = document.getElementById('search-box');
  const ingBox = document.getElementById('ing-search-box');
  const catBox = document.getElementById('catalog-search-box'); // Nuevo
  
  if (posBox && e.target.id !== 'pos-search') posBox.style.display = 'none';
  if (ingBox && e.target.id !== 'ing-search-input') ingBox.style.display = 'none';
  if (catBox && e.target.id !== 'catalog-search-input') catBox.style.display = 'none'; // Nuevo
});


// ==========================================
// 2. SEGURIDAD Y ACCESO (LOGIN)
// ==========================================
function validateLogin() {
  const u = document.getElementById('login-user').value.trim();
  const p = document.getElementById('login-pass').value.trim();
  const s = document.getElementById('login-secret').value.trim();
  const err = document.getElementById('login-error-msg');

  if(u === AUTH.user && p === AUTH.pass && s === AUTH.secret) {
    if (err) err.style.display = 'none';
    sessionStorage.setItem('f_logged', 'true');
    document.body.classList.add('authenticated');
    initSystem();
  } else {
    if (err) err.style.display = 'block';
  }
}

function logout() {
  sessionStorage.removeItem('f_logged');
  document.body.classList.remove('authenticated');
}

function switchSection(secId, btn) {
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.sidebar .menu-btn').forEach(b => b.classList.remove('active'));
  
  const targetSec = document.getElementById('sec-' + secId);
  if (targetSec) targetSec.classList.add('active');
  if (btn) btn.classList.add('active');
  
  initSystem();
}

function initSystem() {
  renderDropdowns();
  renderCatalog();
  renderInventory();
  renderRealInventory();
  renderPricesTable();
  renderSimulation();
  renderSalesHistory();
}


// ==========================================
// 3. MÓDULO POS: BUSCADOR Y VENTAS
// ==========================================
function handleSearch(val) {
  const box = document.getElementById('search-box');
  if (!box) return;
  if (!val.trim()) { box.style.display = 'none'; return; }

  const prods = DB.get('f_prods', []);
  const query = val.toLowerCase();
  
  const filtered = prods.filter(p => 
    p.desc.toLowerCase().includes(query) || 
    (p.barcode && p.barcode.includes(query))
  );

  if (filtered.length === 0) {
    box.innerHTML = `<div class="predictive-item" style="color:var(--muted); padding:10px;">Sin resultados en vademécum...</div>`;
  } else {
    box.innerHTML = filtered.map(p => `
      <div class="predictive-item" onclick="selectProductToConfigure('${p.id}')">
        <span style="font-weight:600; color:#fff;">${p.desc}</span>
        <span style="float:right;" class="badge badge-purple">${p.forma}</span>
      </div>
    `).join('');
  }
  box.style.display = 'block';
}

function selectProductToConfigure(pid) {
  if (document.getElementById('search-box')) document.getElementById('search-box').style.display = 'none';
  if (document.getElementById('pos-search')) document.getElementById('pos-search').value = '';

  const prods = DB.get('f_prods', []);
  const p = prods.find(x => x.id === pid);
  if(!p) return;

  if (document.getElementById('pre-id')) document.getElementById('pre-id').value = p.id;
  if (document.getElementById('pre-title')) document.getElementById('pre-title').innerText = `Configurar Despacho: ${p.desc}`;
  if (document.getElementById('pre-mode')) document.getElementById('pre-mode').value = 'Unidad';
  if (document.getElementById('pre-price')) document.getElementById('pre-price').value = p.priceUnit || 0;
  if (document.getElementById('pre-qty')) document.getElementById('pre-qty').value = "1";

  if (document.getElementById('pre-add-panel')) document.getElementById('pre-add-panel').style.display = 'block';
}

function updatePrePrice() {
  const pid = document.getElementById('pre-id') ? document.getElementById('pre-id').value : '';
  const mode = document.getElementById('pre-mode') ? document.getElementById('pre-mode').value : 'Unidad';
  const prods = DB.get('f_prods', []);
  const p = prods.find(x => x.id === pid);
  if(!p) return;

  const priceEl = document.getElementById('pre-price');
  if (!priceEl) return;

  if(mode === 'Caja') {
    priceEl.value = p.priceBox || 0;
  } else if(mode === 'Blíster') {
    priceEl.value = ((p.priceBox / (p.boxUnits / p.blisterUnits)) || (p.priceUnit * p.blisterUnits)).toFixed(2);
  } else {
    priceEl.value = p.priceUnit || 0;
  }
}

function confirmAddToCart() {
  const pid = document.getElementById('pre-id') ? document.getElementById('pre-id').value : '';
  const mode = document.getElementById('pre-mode') ? document.getElementById('pre-mode').value : 'Unidad';
  const price = parseFloat(document.getElementById('pre-price') ? document.getElementById('pre-price').value : '0') || 0;
  const qty = parseInt(document.getElementById('pre-qty') ? document.getElementById('pre-qty').value : '1') || 1;

  const prods = DB.get('f_prods', []);
  const p = prods.find(x => x.id === pid);
  if(!p) return;

  cart.push({
    id: p.id,
    desc: p.desc,
    mode: mode,
    customPrice: price,
    qty: qty
  });

  if (document.getElementById('pre-add-panel')) document.getElementById('pre-add-panel').style.display = 'none';
  renderCart();
}

function removeCartItem(index) {
  cart.splice(index, 1);
  renderCart();
}

function renderCart() {
  const tbody = document.getElementById('cart-table-body');
  if(!tbody) return;

  if(cart.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--muted);">La lista está vacía. Seleccione un producto arriba y agréguelo.</td></tr>`;
    calculateTotals();
    return;
  }

  tbody.innerHTML = cart.map((item, index) => `
    <tr>
      <td><strong>${item.desc}</strong></td>
      <td><span class="badge badge-purple">${item.mode}</span></td>
      <td>S/. ${item.customPrice.toFixed(2)}</td>
      <td><strong>${item.qty}</strong></td>
      <td><span style="color:#fff; font-weight:600;">S/. ${(item.customPrice * item.qty).toFixed(2)}</span></td>
      <td><button class="btn btn-danger" style="padding:4px 8px;" onclick="removeCartItem(${index})"><i class="ri-delete-bin-line"></i></button></td>
    </tr>
  `).join('');

  calculateTotals();
}

function calculateTotals() {
  let total = 0;
  cart.forEach(item => { total += (item.customPrice * item.qty); });
  const igv = total * 0.18;
  const subtotal = total -igv;
 

  if (document.getElementById('tot-sub')) document.getElementById('tot-sub').innerText = "S/. " + subtotal.toFixed(2);
  if (document.getElementById('tot-igv')) document.getElementById('tot-igv').innerText = "S/. " + igv.toFixed(2);
  if (document.getElementById('tot-final')) document.getElementById('tot-final').innerText = "S/. " + total.toFixed(2);
}

function processSale() {
  const tableBody = document.getElementById("cart-table-body");
  if(!tableBody) return;
  
  if (tableBody.querySelectorAll("tr").length <= 1 && tableBody.innerText.includes("vacía")) {
    alert("⚠️ No hay productos en la lista para facturar.");
    return;
  }

  // --- NUEVAS CAPTURAS DE DATOS DE CLIENTE Y COMPROBANTE ---
  const saleDocType = document.getElementById('sale-doc-type') ? document.getElementById('sale-doc-type').value : 'BOLETA';
  const clientDoc = (document.getElementById("cli-doc") ? document.getElementById("cli-doc").value.trim() : "") || "S/D";
  const clientName = (document.getElementById("cli-name") ? document.getElementById("cli-name").value.trim() : "") || "PÚBLICO GENERAL";
  const clientAddress = (document.getElementById("cli-address") ? document.getElementById("cli-address").value.trim() : "") || "S/D";
  const totalFinal = document.getElementById("tot-final") ? document.getElementById("tot-final").innerText : "S/. 0.00";
  const subtotalFinal = document.getElementById("tot-sub") ? document.getElementById("tot-sub").innerText : "S/. 0.00";
  const igvFinal = document.getElementById("tot-igv") ? document.getElementById("tot-igv").innerText : "S/. 0.00";
  
  // --- VALIDACIÓN ESTRICTA SI ES FACTURA ---
  if (saleDocType === 'FACTURA') {
    if (clientDoc.length !== 11) {
      alert("⚠️ Para una Factura, el RUC debe tener obligatoriamente 11 dígitos.");
      return;
    }
    if (clientName === "PÚBLICO GENERAL" || !clientName || clientAddress === "S/D" || !clientAddress) {
      alert("⚠️ Para emitir una Factura es obligatorio colocar la Razón Social y la Dirección Fiscal de la empresa.");
      return;
    }
  }

  // --- GENERACIÓN DINÁMICA DE SERIE Y CORRELATIVO ---
  // Si es Factura genera F001-XXXXXX, si es Boleta genera B001-XXXXXX
  const prefix = saleDocType === 'FACTURA' ? 'F001-' : 'B001-';
  const ticketNum = prefix + Math.floor(100000 + Math.random() * 900000);
  
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  let prods = DB.get('f_prods', []);
  let lots = DB.get('f_lots', []);
  let itemsSummary = [];
  
  cart.forEach(item => {
    const pBase = prods.find(x => x.id === item.id);
    let unidadesARestar = item.qty;

    // 1. Determinar cuántas unidades sueltas reales se restarán
    if (pBase) {
      if (item.mode === "Caja") {
        unidadesARestar = item.qty * (parseInt(pBase.boxUnits) || 100);
      } else if (item.mode === "Blíster") {
        unidadesARestar = item.qty * (parseInt(pBase.blisterUnits) || 10);
      }
    }

    // 2. Obtener el costo unitario base (salvavidas por si acaso)
    let costoUnitarioLote = 0;
    if (pBase) {
      if (pBase.costMode === "Caja") {
        costoUnitarioLote = (parseFloat(pBase.cost) || 0) / (parseInt(pBase.boxUnits) || 100);
      } else {
        costoUnitarioLote = parseFloat(pBase.cost) || 0;
      }
    }

    // 3. LOGICA CRÍTICA DEL INVENTARIO: Recorrer lotes y restar el stock real
    let stockRestante = unidadesARestar;
    for (let i = 0; i < lots.length; i++) {
      if (lots[i].prodId === item.id && lots[i].stockUnits > 0) {
        
        // Si encontramos un lote con stock, jalamos su costo real para que sea más exacto
        if (lots[i].cost) {
          if (lots[i].costMode === "Caja" && pBase) {
            costoUnitarioLote = (parseFloat(lots[i].cost) || 0) / (parseInt(pBase.boxUnits) || 100);
          } else {
            costoUnitarioLote = parseFloat(lots[i].cost) || 0;
          }
        }

        // Restamos del inventario (Tu lógica original intacta)
        if (lots[i].stockUnits >= stockRestante) {
          lots[i].stockUnits -= stockRestante;
          stockRestante = 0;
          break;
        } else {
          stockRestante -= lots[i].stockUnits;
          lots[i].stockUnits = 0;
        }
      }
    }

    // 4. Cálculos finales de dinero para la Caja y Ganancia Neta
    let costoTotalItem = costoUnitarioLote * unidadesARestar;
    let precioTotalItem = item.customPrice * item.qty;
    let gananciaItem = precioTotalItem - costoTotalItem;

    // Estructurar el formato para el historial de ventas
    itemsSummary.push({
      id: item.id, 
      name: item.desc,
      mode: item.mode,
      price: "S/. " + item.customPrice.toFixed(2),
      qty: item.qty,
      subtotal: "S/. " + precioTotalItem.toFixed(2),
      costoTotal: costoTotalItem,  // Requerido para el cálculo de ganancia total en el reporte
      gananciaNeta: gananciaItem    // Requerido para ver tu margen neto real
    });
  });

  DB.set('f_lots', lots);

  // --- GUARDANDO LA NUEVA ESTRUCTURA EN EL HISTORIAL ---
  const newSale = {
    ticket: ticketNum,
    tipoComprobante: saleDocType, // Guardará 'BOLETA' o 'FACTURA'
    date: dateStr,
    time: timeStr,
    doc: clientDoc,               // Guardará el DNI o RUC
    client: clientName,           // Nombres o Razón social
    address: clientAddress,       // Dirección fiscal
    items: itemsSummary,
    subtotal: subtotalFinal, // 🌟 ¡Añadido! Ahora sí se guardará para el ticket
    igv: igvFinal,           // 🌟 ¡Añadido! Ahora sí se guardará para el ticket
    total: totalFinal,
    estado: "ACTIVA"
  };

  let salesHistory = JSON.parse(localStorage.getItem("sales_history")) || [];
  salesHistory.push(newSale);
  localStorage.setItem("sales_history", JSON.stringify(salesHistory));

// ... (todo el código anterior de tu función de venta se mantiene igual) ...

  alert(`✅ Venta Grabada con Éxito. ¡Stock descontado!\n${saleDocType}: ${ticketNum}`);

  if (confirm(`¿Desea imprimir la ${saleDocType.toLowerCase()} de esta venta ahora?`)) {
    openReceiptModalDirect(newSale);
  }

  // --- AQUÍ ESTÁ EL CAMBIO DE LIMPIEZA ---
  cart = [];
  
  // Borramos los anteriores e ingresamos estos que limpian los nuevos inputs:
  if (document.getElementById('sale-doc-type')) document.getElementById('sale-doc-type').value = 'BOLETA';
  if (document.getElementById("cli-doc")) document.getElementById("cli-doc").value = "";
  if (document.getElementById("cli-name")) document.getElementById("cli-name").value = "";
  if (document.getElementById("cli-address")) document.getElementById("cli-address").value = "";
  
  // Esto hace que visualmente los textos vuelvan a decir "DNI" en lugar de "RUC"
  if (typeof handleDocTypeChange === "function") handleDocTypeChange();
  
  // Esto limpia la tabla visual del carrito (Tu código original)
  tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--muted);">La lista está vacía. Seleccione un producto arriba y agréguelo.</td></tr>`;
  if (document.getElementById("tot-sub")) document.getElementById("tot-sub").innerText = "S/. 0.00";
  if (document.getElementById("tot-igv")) document.getElementById("tot-igv").innerText = "S/. 0.00";
  if (document.getElementById("tot-final")) document.getElementById("tot-final").innerText = "S/. 0.00";
  
  initSystem();
}
function openReceiptModalDirect(sale) {
  // 1. Validar que los elementos del modal existan en el HTML
  const recTicket = document.getElementById("rec-ticket-num");
  const recDate = document.getElementById("rec-date");
  const recDoc = document.getElementById("rec-doc");
  const recCli = document.getElementById("rec-cli");
  const recAddress = document.getElementById("rec-address");
  const recItems = document.getElementById("receipt-items-body");

  // 2. Inyectar los datos dinámicos de la venta
  if (recTicket) {
    // Mostrará "BOLETA: B001-XXXXXX" o "FACTURA: F001-XXXXXX"
    recTicket.innerText = `${sale.tipoComprobante || 'BOLETA'}: ${sale.ticket}`;
  }
  
  if (recDate) {
    recDate.innerText = `FECHA: ${sale.date}  ${sale.time}`;
  }

  // --- AQUÍ SE PINTAN LOS NUEVOS CAMPOS ---
  if (recDoc) {
    // Si es Factura mostrará "RUC: ...", si es Boleta mostrará "DNI: ..."
    const labelDoc = sale.tipoComprobante === 'FACTURA' ? 'RUC' : 'DNI';
    recDoc.innerText = `${labelDoc}: ${sale.doc || 'S/D'}`;
  }

  if (recCli) {
    recCli.innerText = `CLIENTE: ${sale.client || 'PÚBLICO GENERAL'}`;
  }

  if (recAddress) {
    recAddress.innerText = `DIRECCIÓN: ${sale.address || 'S/D'}`;
  }

  // 3. Renderizar la lista de productos (Esto mantiene tu lógica original)
  // 3. Renderizar la lista de productos corregida
  if (recItems) {
    recItems.innerHTML = "";
    sale.items.forEach(item => {
      // Intentamos obtener el nombre buscando en todas las variables posibles que pueda tener tu objeto item
      const nombreProducto = item.name || item.desc || item.descripcion || "Producto sin nombre";
      
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="padding:4px 0; color:#000;">${nombreProducto} (${item.mode || 'Unidad'})</td>
        <td style="text-align:right; padding:4px 0; color:#000;">${item.qty}</td>
        <td style="text-align:right; padding:4px 0; color:#000;">${item.subtotal || item.total || '0.00'}</td>
      `;
      recItems.appendChild(tr);
    });
  }

  // 4. Totales (Mantiene tu lógica original)
  if (document.getElementById("rec-sub")) document.getElementById("rec-sub").innerText = sale.subtotal || "S/. 0.00";
  if (document.getElementById("rec-igv")) document.getElementById("rec-igv").innerText = sale.igv || "S/. 0.00";
  if (document.getElementById("rec-total")) document.getElementById("rec-total").innerText = sale.total;

  // 5. Mostrar el modal en pantalla
  // ... (Código anterior de openReceiptModalDirect donde rellenas los datos) ...

  // 5. Mostrar el modal en pantalla (Tu código actual)
  const modal = document.getElementById("receipt-modal");
  if (modal) {
    modal.style.display = "flex";
    
    // AGREGA ESTO AQUÍ: Fuerza al navegador a abrir la ventana de impresión de inmediato
    setTimeout(() => {
      window.print();
    }, 300); // 300 milisegundos de espera para asegurar que el texto ya se dibujó
  }
}

function showReceipt(ticketNum) {
  let salesHistory = JSON.parse(localStorage.getItem("sales_history")) || [];
  const sale = salesHistory.find(s => s.ticket === ticketNum);
  if(!sale) return;

  if (document.getElementById('rec-ticket-num')) document.getElementById('rec-ticket-num').innerText = "BOLETA: " + sale.ticket;
  if (document.getElementById('rec-date')) document.getElementById('rec-date').innerText = "FECHA: " + sale.date + " " + sale.time;
  if (document.getElementById('rec-cli')) document.getElementById('rec-cli').innerText = "CLIENTE: " + sale.client;
  if (document.getElementById('rec-phone')) document.getElementById('rec-phone').innerText = "TELÉFONO: " + sale.phone;

  const recBody = document.getElementById('receipt-items-body');
  if (recBody) {
    recBody.innerHTML = '';
    sale.items.forEach(item => {
      let tr = document.createElement('tr');
      tr.innerHTML = `<td style="padding:4px 0;">${item.name || item.desc} (${item.mode})</td><td style="text-align:right;">${item.qty}</td><td style="text-align:right;">${item.subtotal}</td>`;
      recBody.appendChild(tr);
    });
  }

  if (document.getElementById('receipt-modal')) document.getElementById('receipt-modal').style.display = 'flex';
}

function closeReceipt() {
  if (document.getElementById('receipt-modal')) document.getElementById('receipt-modal').style.display = 'none';
  cart = [];
  if (document.getElementById('cli-name')) document.getElementById('cli-name').value = '';
  if (document.getElementById('cli-phone')) document.getElementById('cli-phone').value = '';
  renderCart();
  initSystem();
}


// ==========================================
// 4. MÓDULO NUEVO: HISTORIAL INDEPENDIENTE Y CAJA
// ==========================================
function renderSalesHistory() {
  const historyBody = document.getElementById("sales-history-body");
  if (!historyBody) return;

  let startDate = "";
  let endDate = "";

  const startEl = document.getElementById("search-sale-start-date");
  const endEl = document.getElementById("search-sale-end-date");
  const singleEl = document.getElementById("search-sale-date");

  if (startEl && endEl) {
    startDate = startEl.value;
    endDate = endEl.value;
  } else if (singleEl) {
    startDate = singleEl.value;
    endDate = singleEl.value;
  }

  // Actualizar la etiqueta del rango seleccionado
  const closureLabel = document.getElementById("closure-date-label");
  if (closureLabel) {
    closureLabel.innerText = (startDate === endDate) 
      ? "Fecha de Arqueo: " + (startDate || "No seleccionada")
      : `Rango de Arqueo: desde ${startDate} hasta ${endDate}`;
  }

  let salesHistory = JSON.parse(localStorage.getItem("sales_history")) || [];
  let prods = DB.get('f_prods', []);

  if (salesHistory.length === 0 || !startDate || !endDate) {
    historyBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--muted);">Seleccione un rango de fechas para ver el historial.</td></tr>`;
    if (document.getElementById("closure-total-amount")) {
      document.getElementById("closure-total-amount").innerText = "S/. 0.00";
    }
    return;
  }

  historyBody.innerHTML = "";
  let totalVentasActivas = 0;
  let totalVentasEliminadas = 0;
  let totalMargenGanancia = 0;
  let hasSales = false;

  salesHistory.forEach((sale, index) => {
    // Validación por Rango de Fechas Inclusive
    if (sale.date >= startDate && sale.date <= endDate) {
      hasSales = true;
      
      const numPrice = parseFloat(sale.total.replace("S/.", "").replace("S/", "").trim()) || 0;
      const esEliminada = sale.estado === "ELIMINADA";

      if (esEliminada) {
        totalVentasEliminadas += numPrice;
      } else {
        totalVentasActivas += numPrice;

        // Cálculo Dinámico de Margen de Ganancia de la venta Activa
        if (sale.items && Array.isArray(sale.items)) {
          sale.items.forEach(item => {
            let itemSubtotal = parseFloat(item.subtotal.replace("S/.", "").replace("S/", "").trim()) || 0;
            let itemCostTotal = 0;
            
            // Busca el producto por ID o Descripción como Plan B de respaldo histórico
            const pBase = prods.find(x => x.id === item.id || x.desc === item.name);
            if (pBase) {
              let costPerUnit = 0;
              let boxUnits = parseInt(pBase.boxUnits) || 100;
              let blisterUnits = parseInt(pBase.blisterUnits) || 10;
              let baseCost = parseFloat(pBase.cost) || 0;

              // Encontrar costo base unitario según la configuración de almacén
              if (pBase.costMode === "Caja") {
                costPerUnit = baseCost / boxUnits;
              } else if (pBase.costMode === "Blíster") {
                costPerUnit = baseCost / blisterUnits;
              } else {
                costPerUnit = baseCost;
              }

              // Multiplicar el costo de acuerdo al tipo de despacho realizado
              if (item.mode === "Caja") {
                itemCostTotal = costPerUnit * boxUnits * item.qty;
              } else if (item.mode === "Blíster") {
                itemCostTotal = costPerUnit * blisterUnits * item.qty;
              } else {
                itemCostTotal = costPerUnit * item.qty;
              }
            }
            
            // Margen = Ingreso de Venta - Costo Real de Adquisición
            totalMargenGanancia += (itemSubtotal - itemCostTotal);
          });
        }
      }

      let productsHtml = sale.items.map(it => `• ${it.name} (${it.qty} ${it.mode})`).join("<br>");
      if (esEliminada && sale.motivoAnulacion) {
        productsHtml += `<br><span style="color:#ffb3b3; font-size:0.75rem; display:block; margin-top:4px;">❌ <strong>Motivo:</strong> ${sale.motivoAnulacion}</span>`;
      }

      const tr = document.createElement("tr");
      if (esEliminada) {
        tr.style.background = "rgba(239, 68, 68, 0.15)";
        tr.style.borderLeft = "4px solid var(--danger)";
      }

      tr.innerHTML = `
        <td><strong style="${esEliminada ? 'text-decoration: line-through; color: var(--danger);' : ''}">${sale.ticket}</strong></td>
        <td>${sale.date}<br><small style="color:var(--muted);">${sale.time}</small></td>
        <td><strong>${sale.client}</strong><br><small style="color:var(--muted)">Tel: ${sale.phone}</small></td>
        <td style="font-size:0.8rem; color:#dcd7f5;">${productsHtml}</td>
        <td>
          <span style="font-weight:700; color: ${esEliminada ? 'var(--danger)' : 'var(--success)'};">
            ${esEliminada ? '- ' : ''}${sale.total}
          </span>
        </td>
        <td style="display: flex; gap: 4px; align-items: center;">
          <button class="btn btn-primary" style="padding: 4px 8px; font-size: 0.75rem;" onclick="reprintOldSaleByIndex(${index})">
            <i class="ri-printer-line"></i>
          </button>
          ${!esEliminada ? `
            <button class="btn btn-danger" style="padding: 4px 8px; font-size: 0.75rem; background: rgba(239, 68, 68, 0.2);" onclick="anularVentaVillasar(${index})">
              <i class="ri-delete-bin-line"></i> Eliminar
            </button>
          ` : `<span class="badge badge-alert-roja" style="font-size:0.7rem;">ELIMINADA</span>`}
        </td>
      `;
      historyBody.appendChild(tr);
    }
  });

  const closureTotalAmountEl = document.getElementById("closure-total-amount");
  if (!hasSales) {
    historyBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--muted);">No se encontraron ventas para el rango seleccionado.</td></tr>`;
    if (closureTotalAmountEl) closureTotalAmountEl.innerText = "S/. 0.00";
  } else {
    // Renderizado en cuadricula limpia de los 3 valores solicitados
    if (closureTotalAmountEl) {
      closureTotalAmountEl.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; margin-top: 10px; text-align: left;">
          <div style="background: rgba(16, 185, 129, 0.12); padding: 12px; border-radius: 6px; border-left: 4px solid var(--success);">
            <span style="font-size:0.78rem; color:#a1a1aa; display:block; font-weight:600;">SUMA TOTAL VENTAS (ACTIVO)</span>
            <span style="font-size:1.3rem; font-weight:800; color:var(--success);">S/. ${totalVentasActivas.toFixed(2)}</span>
          </div>
          <div style="background: rgba(239, 68, 68, 0.12); padding: 12px; border-radius: 6px; border-left: 4px solid var(--danger);">
            <span style="font-size:0.78rem; color:#a1a1aa; display:block; font-weight:600;">SUMA VENTAS ANULADAS</span>
            <span style="font-size:1.3rem; font-weight:800; color:var(--danger);">S/. ${totalVentasEliminadas.toFixed(2)}</span>
          </div>
          <div style="background: rgba(0, 213, 255, 0.12); padding: 12px; border-radius: 6px; border-left: 4px solid #00d5ff;">
            <span style="font-size:0.78rem; color:#a1a1aa; display:block; font-weight:600;">MARGEN DE GANANCIA NETO</span>
            <span style="font-size:1.3rem; font-weight:800; color:#00d5ff;">S/. ${totalMargenGanancia.toFixed(2)}</span>
          </div>
        </div>
        <div style="font-size:1.4rem; font-weight:800; margin-top:15px; text-align: right; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px;">
          CAJA NETO REAL: S/. ${(totalVentasActivas).toFixed(2)}
        </div>
      `;
    }
  }
}

function reprintOldSaleByIndex(index) {
  let salesHistory = JSON.parse(localStorage.getItem("sales_history")) || [];
  const selectedSale = salesHistory[index];
  
  if (selectedSale) {
    openReceiptModalDirect(selectedSale);
  } else {
    alert("⚠️ No se pudo recuperar los datos de la boleta seleccionada.");
  }
}

window.reprintOldSale = function(sale) {
  openReceiptModalDirect(sale);
};


// ==========================================
// 5. MÓDULO ALMACÉN: INGRESOS Y BUSCADOR
// ==========================================
function handleIngressSearch(val) {
  const box = document.getElementById('ing-search-box');
  if (!box) return;
  if (!val.trim()) { box.style.display = 'none'; return; }

  const prods = DB.get('f_prods', []);
  const query = val.toLowerCase();
  const filtered = prods.filter(p => p.desc.toLowerCase().includes(query) || (p.barcode && p.barcode.includes(query)));

  if (filtered.length === 0) {
    box.innerHTML = `<div class="predictive-item" style="color:var(--muted); padding:10px;">Sin coincidencias en catálogo...</div>`;
  } else {
    box.innerHTML = filtered.map(p => `
      <div class="predictive-item" onclick="selectProductToIngress('${p.id}', '${p.desc.replace(/'/g, "\\'")}')" style="padding:10px; cursor:pointer;">
        <span style="font-weight:600; color:#fff;">${p.desc}</span> 
        <span style="float:right;" class="badge badge-purple">${p.forma}</span>
      </div>
    `).join('');
  }
  box.style.display = 'block';
}

function selectProductToIngress(pid, pdesc) {
  if (document.getElementById('ing-search-box')) document.getElementById('ing-search-box').style.display = 'none';
  if (document.getElementById('ing-search-input')) document.getElementById('ing-search-input').value = pdesc;
  if (document.getElementById('ing-prod')) document.getElementById('ing-prod').value = pid;
  if (document.getElementById('ing-selected-feedback')) document.getElementById('ing-selected-feedback').innerText = `📦 Listo para ingresar: ${pdesc}`;
  updateIngressoPrecios();
}

function updateIngressoPrecios() {
  const prodEl = document.getElementById('ing-prod');
  if (!prodEl) return;
  const pid = prodEl.value;
  const prods = DB.get('f_prods', []);
  const p = prods.find(item => item.id === pid);
  if(p) {
    if (document.getElementById('ing-cost')) document.getElementById('ing-cost').value = p.cost || '';
    if (document.getElementById('ing-cost-mode')) document.getElementById('ing-cost-mode').value = p.costMode || 'Caja';
  }
}

function executeIngress() {
  const pid = document.getElementById('ing-prod').value;
  const qty = parseInt(document.getElementById('ing-qty').value) || 0;
  const unitType = document.getElementById('ing-unit-type').value; 
  
  // CAMBIO AQUÍ: Se elimina la lectura del input y se asigna el lote directo por defecto
  const lot = "LOTE-VILLAZAR";
  
  const expiry = document.getElementById('ing-expiry').value;
  const cost = parseFloat(document.getElementById('ing-cost').value) || 0;
  const costMode = document.getElementById('ing-cost-mode').value;

  if(!pid) { alert("Por favor use el buscador y seleccione un medicamento válido."); return; }
  if(qty <= 0) { alert("Ingrese cantidad válida"); return; }
  if(!expiry) { alert("Por favor, asigne una Fecha de Vencimiento para el control de alertas."); return; }

  const prods = DB.get('f_prods', []);
  const pIndex = prods.findIndex(x => x.id === pid);
  if(pIndex === -1) return;

  let finalUnits = qty;
  if (unitType === "Caja") {
    finalUnits = qty * prods[pIndex].boxUnits;
  }

  prods[pIndex].cost = cost;
  prods[pIndex].costMode = costMode;
  DB.set('f_prods', prods);

  let lots = DB.get('f_lots', []);
  let existingLot = lots.find(l => l.prodId === pid && l.code.toUpperCase() === lot.toUpperCase());

  if (existingLot) {
    existingLot.stockUnits += finalUnits;
    existingLot.expiry = expiry; 
  } else {
    lots.push({
      id: "L-" + Date.now() + Math.floor(Math.random()*100),
      prodId: pid,
      code: lot.toUpperCase(),
      expiry: expiry,
      stockUnits: finalUnits
    });
  }
  
  DB.set('f_lots', lots);
  alert(`✅ Mercadería procesada e integrada al lote único: ${lot}`);
  
  // Limpiar campos de feedback
  document.getElementById('ing-search-input').value = '';
  document.getElementById('ing-prod').value = '';
  document.getElementById('ing-selected-feedback').innerText = '';
  
  initSystem();
}


// ==========================================
// 6. CONTROL DE KÁRDEX CENTRAL Y ALERTAS
// ==========================================
function checkExpiryStatus(expiryDateStr, lotId) {
  const silenced = DB.get('f_silenced_alerts', []);
  if (silenced.includes(lotId)) {
    return { styleClass: '', badge: '<span class="badge badge-secondary">Apagada Man.</span>', hasAlert: false };
  }

  if (!expiryDateStr || expiryDateStr === 'S/V') {
    return { styleClass: '', badge: '—', hasAlert: false };
  }

  const today = new Date();
  const expiry = new Date(expiryDateStr);
  const timeDiff = expiry.getTime() - today.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

  // Ajustado: Rojo para menos de 3 meses (90 días), Amarillo para menos de 6 meses (180 días)
  if (daysDiff <= 90) {
    return { styleClass: 'alert-row-roja', badge: '<span class="badge badge-alert-roja">⚠️ Alerta Roja (&lt;3 Meses)</span>', hasAlert: true };
  } else if (daysDiff <= 180) {
    return { styleClass: 'alert-row-yellow', badge: '<span class="badge badge-alert-yellow">⚠️ Alerta Amarilla (&lt;6 Meses)</span>', hasAlert: true };
  }

  return { styleClass: '', badge: '<span class="badge badge-green">Vigente</span>', hasAlert: false };
}

function silenceAlert(lotId) {
  let silenced = DB.get('f_silenced_alerts', []);
  if (!silenced.includes(lotId)) {
    silenced.push(lotId);
    DB.set('f_silenced_alerts', silenced);
  }
  renderRealInventory();
}

function renderRealInventory() {
  const tbody = document.getElementById('real-inventory-table-body');
  if(!tbody) return;
  
  const query = document.getElementById('inv-search').value.toLowerCase().trim();
  const prods = DB.get('f_prods', []);
  const lots = DB.get('f_lots', []);

  if(lots.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--muted);">No hay lotes ni stock registrado en inventario real.</td></tr>`;
    return;
  }

  let html = "";
  lots.forEach(l => {
    const p = prods.find(x => x.id === l.prodId);
    if (!p) return;

    if (query && !p.desc.toLowerCase().includes(query) && !l.code.toLowerCase().includes(query)) {
      return;
    }

    const alertStatus = checkExpiryStatus(l.expiry, l.id);

    html += `
      <tr class="${alertStatus.styleClass}">
        <td><strong>${p.id}</strong><br><small class="badge" style="background:rgba(255,255,255,0.1);">${l.code}</small></td>
        <td><span style="color:#fff; font-weight:600;">${p.desc}</span></td>
        <td><strong>${l.expiry}</strong></td>
        <td>${alertStatus.badge}</td>
        <td><span class="badge badge-purple">${l.stockUnits} uds</span></td>
        <td>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-secondary" style="padding:4px 8px; font-size:0.75rem; border-color:var(--p3);" onclick="openEditModal('${l.id}')"><i class="ri-edit-2-line"></i> Editar</button>
            ${alertStatus.hasAlert ? `<button class="btn btn-danger" style="padding:4px 8px; font-size:0.75rem;" onclick="silenceAlert('${l.id}')"><i class="ri-notification-off-line"></i> Apagar</button>` : ''}
            <button class="btn btn-danger" style="padding:4px 8px; font-size:0.75rem; background: rgba(239, 68, 68, 0.2); color: #ff8080; border: 1px solid rgba(239, 68, 68, 0.4);" onclick="deleteLot('${l.id}')"><i class="ri-delete-bin-line"></i> Eliminar</button>
          </div>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html || `<tr><td colspan="6" style="text-align:center; color:var(--muted);">Sin resultados.</td></tr>`;
}


// ==========================================
// 7. EDICIÓN INTERNA CON AUTORIZACIÓN
// ==========================================
function openEditModal(lotId) {
  const lots = DB.get('f_lots', []);
  const prods = DB.get('f_prods', []);
  const lotItem = lots.find(l => l.id === lotId);
  if(!lotItem) return;

  const p = prods.find(x => x.id === lotItem.prodId);

  if(document.getElementById('edit-target-lot-id')) document.getElementById('edit-target-lot-id').value = lotId;
  if(document.getElementById('edit-modal-title')) document.getElementById('edit-modal-title').innerText = `${p ? p.desc : 'Medicamento'} - Lote: ${lotItem.code}`;
  if(document.getElementById('edit-new-stock')) document.getElementById('edit-new-stock').value = lotItem.stockUnits;
  if(document.getElementById('edit-new-expiry')) document.getElementById('edit-new-expiry').value = lotItem.expiry;
  
  if(document.getElementById('edit-auth-secret')) document.getElementById('edit-auth-secret').value = "";
  if(document.getElementById('edit-step-auth')) document.getElementById('edit-step-auth').style.display = "block";
  if(document.getElementById('edit-step-fields')) document.getElementById('edit-step-fields').style.display = "none";

  if(document.getElementById('edit-inventory-modal')) document.getElementById('edit-inventory-modal').style.display = "flex";
}

function unlockEditFields() {
  const codeInput = document.getElementById('edit-auth-secret') ? document.getElementById('edit-auth-secret').value : '';
  if(codeInput === AUTH.secret) {
    if(document.getElementById('edit-step-auth')) document.getElementById('edit-step-auth').style.display = "none";
    if(document.getElementById('edit-step-fields')) document.getElementById('edit-step-fields').style.display = "block";
  } else {
    alert("🔒 Código secreto inválido. Acceso de edición denegado.");
  }
}

// Guarda los cambios aplicados directamente desde el inventario real y refresca los avisos visuales
function saveInventoryEdits() {
  const lotId = document.getElementById('edit-target-lot-id') ? document.getElementById('edit-target-lot-id').value : '';
  const newStock = parseInt(document.getElementById('edit-new-stock') ? document.getElementById('edit-new-stock').value : '0');
  const newExpiry = document.getElementById('edit-new-expiry') ? document.getElementById('edit-new-expiry').value : '';

  if(isNaN(newStock) || newStock < 0) { alert("Ingrese un stock físico válido."); return; }
  if(!newExpiry) { alert("Ingrese una fecha de vencimiento válida."); return; }

  let lots = DB.get('f_lots', []);
  let index = lots.findIndex(l => l.id === lotId);

  if(index !== -1) {
    lots[index].stockUnits = newStock;
    lots[index].expiry = newExpiry;
    
    // Al ser editada la fecha voluntariamente, se quita del arreglo de silenciados para recalcular su estado real
    let silenced = DB.get('f_silenced_alerts', []);
    silenced = silenced.filter(id => id !== lotId);
    DB.set('f_silenced_alerts', silenced);

    DB.set('f_lots', lots);
    alert("Los cambios se aplicaron e integraron perfectamente en el Kárdex.");
    closeEditModal();
    initSystem();
  }
}

function closeEditModal() {
  if(document.getElementById('edit-inventory-modal')) document.getElementById('edit-inventory-modal').style.display = "none";
}


// ==========================================
// 8. REGISTROS, FORMULARIOS Y PRECIOS
// ==========================================
function renderDropdowns() {
  const cSel = document.getElementById('p-cat');
  const fSel = document.getElementById('p-forma');
  const sSel = document.getElementById('sim-prod');
  
  const cats = DB.get('f_cats', []);
  const formas = DB.get('f_formas', []);
  const prods = DB.get('f_prods', []);

  if(cSel) cSel.innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');
  if(fSel) fSel.innerHTML = formas.map(f => `<option value="${f}">${f}</option>`).join('');
  if(sSel) sSel.innerHTML = prods.map(p => `<option value="${p.id}">${p.desc}</option>`).join('');
}

function addCategory() {
  // CAMBIO: Ahora solicita la nueva categoría en una ventana emergente interactiva
  const val = prompt("Ingrese el nombre de la nueva categoría (Ej: Antigripales, Pediatría):");
  if(!val || !val.trim()) return;
  
  let cats = DB.get('f_cats', []);
  const nuevaCat = val.trim();
  
  if(!cats.includes(nuevaCat)) {
    cats.push(nuevaCat);
    DB.set('f_cats', cats);
    alert(`✅ Categoría "${nuevaCat}" agregada con éxito.`);
  } else {
    alert("⚠️ Esta categoría ya existe en el sistema.");
  }
  renderDropdowns();
}

function addForma() {
  // CAMBIO: Ahora solicita la nueva forma farmacéutica en una ventana emergente interactiva
  const val = prompt("Ingrese la nueva forma farmacéutica (Ej: Crema, Gotas, Inhalador):");
  if(!val || !val.trim()) return;
  
  let formas = DB.get('f_formas', []);
  const nuevaForma = val.trim();
  
  if(!formas.includes(nuevaForma)) {
    formas.push(nuevaForma);
    DB.set('f_formas', formas);
    alert(`✅ Forma farmacéutica "${nuevaForma}" agregada con éxito.`);
  } else {
    alert("⚠️ Esta forma farmacéutica ya existe en el sistema.");
  }
  renderDropdowns();
}

function saveProduct() {
  const desc = document.getElementById('p-desc').value.trim();
  const boxUnits = parseInt(document.getElementById('p-box-units').value) || 1;
  const blisterUnits = parseInt(document.getElementById('p-blister-units').value) || 1;
  const cat = document.getElementById('p-cat').value;
  const forma = document.getElementById('p-forma').value;
  const barcode = document.getElementById('p-barcode').value.trim();

  if(!desc) { alert("Ingrese el nombre/descripción"); return; }

  let prods = DB.get('f_prods', []);
  const editIdEl = document.getElementById('p-id-edit');
  const editId = editIdEl ? editIdEl.value : '';

  if (editId) {
    // MODO EDICIÓN: Actualizar el ítem existente
    let idx = prods.findIndex(x => x.id === editId);
    if (idx !== -1) {
      prods[idx].desc = desc;
      prods[idx].boxUnits = boxUnits;
      prods[idx].blisterUnits = blisterUnits;
      prods[idx].cat = cat;
      prods[idx].forma = forma;
      prods[idx].barcode = barcode;
      
      DB.set('f_prods', prods);
      alert("✅ Producto actualizado de forma permanente en el Vademécum.");
      cancelCatalogEdit();
    }
  } else {
    // MODO CREACIÓN: Agregar producto nuevo
    const newId = "PROD-" + String(prods.length + 1).padStart(3, '0');
    prods.push({
      id: newId, desc: desc, boxUnits: boxUnits, blisterUnits: blisterUnits,
      cat: cat, forma: forma, barcode: barcode, cost: 0, costMode: "Caja",
      priceBox: 0, priceUnit: 0, useIgv: true
    });
    DB.set('f_prods', prods);
    alert("✅ Producto creado exitosamente.");
    
    document.getElementById('p-desc').value = '';
    document.getElementById('p-barcode').value = '';
  }

  // Sincronizar de forma automática con la tabla del catálogo base (productos_base)
  let listaProductosBase = prods.map((p, index) => ({
    codigo: p.id,
    descripcion: p.desc,
    categoria: p.cat,
    forma: p.forma
  }));
  localStorage.setItem("productos_base", JSON.stringify(listaProductosBase));

  initSystem();
}

function renderCatalog() {
  const catalogBody = document.getElementById("catalog-table-body");
  if (!catalogBody) return;

  let listaProductosBase = JSON.parse(localStorage.getItem("productos_base")) || [];
  
  // Si la lista de productos_base está vacía, sincronizamos con f_prods para no dejar el catálogo en blanco
  if (listaProductosBase.length === 0) {
    const prods = DB.get('f_prods', []);
    listaProductosBase = prods.map(p => ({
      codigo: p.id,
      descripcion: p.desc,
      categoria: p.cat,
      forma: p.forma
    }));
  }

  catalogBody.innerHTML = "";
  listaProductosBase.forEach((prod, index) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${prod.codigo || index + 1}</td>
      <td>
        <strong id="prod-name-display-${index}">${prod.descripcion}</strong>
        <button class="btn" style="padding: 2px 6px; font-size: 0.7rem; background: rgba(0,213,255,0.1); color: var(--c2); margin-left: 8px;" onclick="editarNombreProductoBase(${index})">
          <i class="ri-edit-line"></i> Editar
        </button>
      </td>
      <td>${prod.categoria}</td>
      <td>${prod.forma}</td>
    `;
    catalogBody.appendChild(tr);
  });
}

// Función puente para habilitar la edición rápida de nombres en el catálogo base sin romper referencias
function editarNombreProductoBase(index) {
  let listaProductosBase = JSON.parse(localStorage.getItem("productos_base")) || [];
  let prods = DB.get('f_prods', []);

  if (listaProductosBase.length === 0) {
    if (prods[index]) {
      const nuevoNombre = prompt("Editar nombre del producto:", prods[index].desc);
      if (nuevoNombre && nuevoNombre.trim()) {
        prods[index].desc = nuevoNombre.trim();
        DB.set('f_prods', prods);
        initSystem();
      }
    }
    return;
  }

  const prod = listaProductosBase[index];
  if (prod) {
    const nuevoNombre = prompt("Editar nombre del producto:", prod.descripcion);
    if (nuevoNombre && nuevoNombre.trim()) {
      prod.descripcion = nuevoNombre.trim();
      localStorage.setItem("productos_base", JSON.stringify(listaProductosBase));
      
      let pIdx = prods.findIndex(x => x.id === prod.codigo || x.desc === prod.descripcion);
      if (pIdx !== -1) {
        prods[pIdx].desc = nuevoNombre.trim();
        DB.set('f_prods', prods);
      }
      initSystem();
    }
  }
}

function renderInventory() {
  const tbody = document.getElementById('inventory-table-body');
  const lots = DB.get('f_lots', []);
  const prods = DB.get('f_prods', []);
  if(!tbody) return;

  tbody.innerHTML = lots.map(l => {
    const p = prods.find(x => x.id === l.prodId) || { desc: "Desconocido" };
    return `<tr><td><strong>${p.desc}</strong></td><td><span>${l.code}</span></td><td>${l.expiry}</td><td><strong>${l.stockUnits} uds</strong></td></tr>`;
  }).join('');
}

function renderPricesTable() {
  const tbody = document.getElementById('prices-table-body');
  const prods = DB.get('f_prods', []);
  if(!tbody) return;

  tbody.innerHTML = prods.map(p => `
    <tr>
      <td><strong>${p.desc}</strong></td>
      <td><input type="number" step="0.01" class="input-ctrl" style="padding:4px; width:80px;" id="cost-${p.id}" value="${p.cost || 0}"></td>
      <td style="text-align:center;"><input type="checkbox" id="igv-${p.id}" ${p.useIgv ? 'checked' : ''}></td>
      <td><input type="number" step="0.01" class="input-ctrl" style="padding:4px; width:90px;" id="pbox-${p.id}" value="${p.priceBox || 0}"></td>
      <td><input type="number" step="0.01" class="input-ctrl" style="padding:4px; width:90px;" id="punit-${p.id}" value="${p.priceUnit || 0}"></td>
      <td><button class="btn btn-primary" style="padding:4px 8px; font-size:0.75rem;" onclick="updatePriceRow('${p.id}')"><i class="ri-save-line"></i></button></td>
    </tr>
  `).join('');
}

function updatePriceRow(pid) {
  let prods = DB.get('f_prods', []);
  let idx = prods.findIndex(x => x.id === pid);
  if(idx === -1) return;

  if (document.getElementById(`cost-${pid}`)) prods[idx].cost = parseFloat(document.getElementById(`cost-${pid}`).value) || 0;
  if (document.getElementById(`igv-${pid}`)) prods[idx].useIgv = document.getElementById(`igv-${pid}`).checked;
  if (document.getElementById(`pbox-${pid}`)) prods[idx].priceBox = parseFloat(document.getElementById(`pbox-${pid}`).value) || 0;
  if (document.getElementById(`punit-${pid}`)) prods[idx].priceUnit = parseFloat(document.getElementById(`punit-${pid}`).value) || 0;

  DB.set('f_prods', prods);
  initSystem();
  alert("Precios actualizados.");
}


// ==========================================
// 9. SIMULADOR DE PEDIDOS
// ==========================================
function renderSimulation() {
  const tbody = document.getElementById('simulation-table-body');
  const sim = DB.get('f_sim', []);
  const prods = DB.get('f_prods', []);
  if(!tbody) return;

  if(sim.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--muted);">Sin pre-órdenes.</td></tr>`;
    return;
  }

  tbody.innerHTML = sim.map((s) => {
    const p = prods.find(x => x.id === s.prodId) || { desc: "—", priceBox: 0, priceUnit: 0 };
    const priceEst = s.type === 'Caja' ? (p.priceBox || 0) : (p.priceUnit || 0);
    return `<tr><td><strong>${p.desc}</strong></td><td>${s.qty} ${s.type}(s)</td><td>S/. ${priceEst.toFixed(2)}</td><td>S/. ${(priceEst * s.qty).toFixed(2)}</td></tr>`;
  }).join('');
}

function addToSimulation() {
  const pid = document.getElementById('sim-prod') ? document.getElementById('sim-prod').value : '';
  const qty = parseInt(document.getElementById('sim-qty') ? document.getElementById('sim-qty').value : '1') || 1;
  const type = document.getElementById('sim-type') ? document.getElementById('sim-type').value : 'Caja';

  let sim = DB.get('f_sim', []);
  sim.push({ prodId: pid, qty: qty, type: type });
  DB.set('f_sim', sim);
  renderSimulation();
}

function commitSimulation() {
  let sim = DB.get('f_sim', []);
  if(sim.length === 0) return;

  let lots = DB.get('f_lots', []);
  const prods = DB.get('f_prods', []);

  // 1. CONFIGURA AQUÍ EL NOMBRE EXACTO DEL LOTE QUE DESEAS USAR
  // Al escribirlo aquí, el sistema se encargará de buscarlo sin importar mayúsculas/minúsculas
  const LOTE_DESTINO = "LOTE-VILLAZAR"; 

  sim.forEach(s => {
    const p = prods.find(x => x.id === s.prodId);
    if(!p) return;

    let totalUnitsCalculated = s.qty;
    if(s.type === 'Caja') totalUnitsCalculated = s.qty * p.boxUnits;

    // 2. SOLUCIÓN CLAVE: Buscamos transformando ambos códigos a MAYÚSCULAS y eliminando espacios (.trim())
    let existingSimLot = lots.find(l => 
      l.prodId === s.prodId && 
      l.code.toUpperCase().trim() === LOTE_DESTINO.toUpperCase().trim()
    );

    if (existingSimLot) {
      // Si el lote ya existe para ese ID de producto, se incrementa el stock perfectamente
      existingSimLot.stockUnits += totalUnitsCalculated;
    } else {
      // Si no existe, se crea un único registro nuevo totalmente estandarizado
      lots.push({
        id: "L-SIM-" + Date.now() + Math.floor(Math.random() * 100),
        prodId: s.prodId,
        code: LOTE_DESTINO.toUpperCase().trim(), // Se guarda limpio en mayúsculas
        expiry: "2026-12-31", // Puedes ajustar la fecha de vencimiento por defecto aquí
        stockUnits: totalUnitsCalculated
      });
    }
  });

  DB.set('f_lots', lots);
  DB.set('f_sim', []);
  alert("Pedido simulado cargado e integrado al Inventario sin duplicar filas.");
  initSystem();
}

function clearSimulation() {
  DB.set('f_sim', []);
  renderSimulation();
}

// 1. Abre el modal profesional de anulación y configura los datos iniciales
function anularVentaVillasar(index) {
  let salesHistory = JSON.parse(localStorage.getItem("sales_history")) || [];
  const sale = salesHistory[index];

  if (!sale) {
    alert("⚠️ No se encontró la venta seleccionada.");
    return;
  }

  if (document.getElementById("delete-target-index")) document.getElementById("delete-target-index").value = index;
  if (document.getElementById("delete-modal-ticket-title")) document.getElementById("delete-modal-ticket-title").innerText = `⚠️ ¿Anular Comprobante ${sale.ticket}?`;
  
  if (document.getElementById("delete-auth-secret")) document.getElementById("delete-auth-secret").value = "";
  if (document.getElementById("delete-reason")) document.getElementById("delete-reason").value = "";
  if (document.getElementById("delete-step-auth")) document.getElementById("delete-step-auth").style.display = "block";
  if (document.getElementById("delete-step-fields")) document.getElementById("delete-step-fields").style.display = "none";

  if (document.getElementById("delete-sale-modal")) document.getElementById("delete-sale-modal").style.display = "flex";
}

// 2. Valida el código secreto corporativo para la auditoría
function unlockDeleteFields() {
  const secretInput = document.getElementById("delete-auth-secret") ? document.getElementById("delete-auth-secret").value.trim() : "";

  if (secretInput === "FARMA777") {
    if (document.getElementById("delete-step-auth")) document.getElementById("delete-step-auth").style.display = "none";
    if (document.getElementById("delete-step-fields")) document.getElementById("delete-step-fields").style.display = "block";
    if (document.getElementById("delete-reason")) document.getElementById("delete-reason").focus();
  } else {
    alert("❌ Código Secreto Incorrecto. Acceso denegado.");
  }
}

// 3. Aplica los cambios de anulación permanentes en el localStorage
function confirmSaleAnulation() {
  const index = document.getElementById("delete-target-index") ? document.getElementById("delete-target-index").value : '';
  const reasonInput = document.getElementById("delete-reason") ? document.getElementById("delete-reason").value.trim() : '';

  if (reasonInput === "") {
    alert("⚠️ Debe ingresar un motivo válido para la auditoría de anulación.");
    return;
  }

  let salesHistory = JSON.parse(localStorage.getItem("sales_history")) || [];
  
  if (salesHistory[index]) {
    salesHistory[index].estado = "ELIMINADA";
    salesHistory[index].motivoAnulacion = reasonInput.toUpperCase();
    localStorage.setItem("sales_history", JSON.stringify(salesHistory));
    alert("❌ Comprobante anulado correctamente en el sistema.");
  }

  closeDeleteModal();
  renderSalesHistory();
}

// 4. Cierra el modal flotante de eliminación de forma limpia
function closeDeleteModal() {
  if (document.getElementById("delete-sale-modal")) document.getElementById("delete-sale-modal").style.display = "none";
}
function deleteLot(lotId) {
  let lots = DB.get('f_lots', []);
  const lotItem = lots.find(l => l.id === lotId);
  if (!lotItem) return;

  const prods = DB.get('f_prods', []);
  const p = prods.find(x => x.id === lotItem.prodId);
  const prodName = p ? p.desc : "Medicamento";

  // 1. Confirmación visual inicial
  if (!confirm(`⚠️ ¿Está seguro de que desea eliminar por completo el lote "${lotItem.code}" del producto "${prodName}"?`)) {
    return;
  }

  // 2. Validación de seguridad con la clave del sistema (FARMA777)
  const secretInput = prompt("🔒 Ingrese el Código Secreto de Autorización para Eliminar:");
  if (secretInput === AUTH.secret) {
    // Filtrar y remover el lote de la base de datos
    lots = lots.filter(l => l.id !== lotId);
    DB.set('f_lots', lots);

    // Limpiar alertas silenciadas de este lote si existían
    let silenced = DB.get('f_silenced_alerts', []);
    silenced = silenced.filter(id => id !== lotId);
    DB.set('f_silenced_alerts', silenced);

    alert("✅ Lote eliminado correctamente del inventario de forma permanente.");
    initSystem(); // Fuerza la actualización inmediata de todas las tablas
  } else if (secretInput !== null) {
    alert("❌ Código Secreto Incorrecto. Acceso denegado.");
  }
}
// ==========================================
// CONTROLADOR DE EDICIÓN Y BUSQUEDA EN VADEMÉCUM
// ==========================================
function handleCatalogProductSearch(val) {
  const box = document.getElementById('catalog-search-box');
  if (!box) return;
  if (!val.trim()) { box.style.display = 'none'; return; }

  const prods = DB.get('f_prods', []);
  const query = val.toLowerCase();
  const filtered = prods.filter(p => 
    p.desc.toLowerCase().includes(query) || 
    (p.barcode && p.barcode.includes(query))
  );

  if (filtered.length === 0) {
    box.innerHTML = `<div class="predictive-item" style="color:var(--muted); padding:10px;">Sin coincidencias...</div>`;
  } else {
    box.innerHTML = filtered.map(p => `
      <div class="predictive-item" onclick="selectProductToEdit('${p.id}')" style="padding:10px; cursor:pointer; border-bottom:1px solid rgba(255,255,255,0.05);">
        <span style="font-weight:600; color:#fff;">${p.desc}</span> 
        <span style="float:right;" class="badge badge-purple">${p.forma}</span>
      </div>
    `).join('');
  }
  box.style.display = 'block';
}

function selectProductToEdit(pid) {
  document.getElementById('catalog-search-box').style.display = 'none';
  if(document.getElementById('catalog-search-input')) {
    document.getElementById('catalog-search-input').value = '';
  }

  const prods = DB.get('f_prods', []);
  const p = prods.find(x => x.id === pid);
  if(!p) return;

  // Asegurar la existencia del campo oculto ID de edición
  let editIdEl = document.getElementById('p-id-edit');
  if(!editIdEl) {
    editIdEl = document.createElement('input');
    editIdEl.type = 'hidden';
    editIdEl.id = 'p-id-edit';
    document.getElementById('p-desc').parentElement.appendChild(editIdEl);
  }
  
  // Setear datos en el formulario existente
  document.getElementById('p-id-edit').value = p.id;
  document.getElementById('p-desc').value = p.desc;
  document.getElementById('p-box-units').value = p.boxUnits || 1;
  document.getElementById('p-blister-units').value = p.blisterUnits || 1;
  document.getElementById('p-cat').value = p.cat || '';
  document.getElementById('p-forma').value = p.forma || '';
  document.getElementById('p-barcode').value = p.barcode || '';

  // Cambiar el diseño del botón de guardar temporalmente
  const saveBtn = document.querySelector("button[onclick='saveProduct()']");
  if(saveBtn) {
    saveBtn.innerHTML = "<i class='ri-save-line'></i> Guardar Cambios Actualizados";
    saveBtn.style.background = "#00d5ff";
    saveBtn.style.color = "#000";
  }
  
  // Crear banner informativo de edición
  let feedback = document.getElementById('catalog-edit-feedback');
  if(!feedback) {
    feedback = document.createElement('div');
    feedback.id = 'catalog-edit-feedback';
    feedback.style.margin = '10px 0';
    feedback.style.padding = '10px';
    feedback.style.background = 'rgba(0, 213, 255, 0.15)';
    feedback.style.borderLeft = '4px solid #00d5ff';
    feedback.style.borderRadius = '4px';
    const descField = document.getElementById('p-desc');
    descField.parentNode.insertBefore(feedback, descField);
  }
  feedback.innerHTML = `✏️ <strong>Modo Edición Activo:</strong> Modificando <em>${p.desc}</em> <button type="button" class="btn btn-secondary" style="padding:2px 6px; font-size:0.7rem; float:right; background:#ef4444;" onclick="cancelCatalogEdit()">Cancelar</button>`;
}

function cancelCatalogEdit() {
  if(document.getElementById('p-id-edit')) document.getElementById('p-id-edit').value = '';
  document.getElementById('p-desc').value = '';
  document.getElementById('p-box-units').value = '1';
  document.getElementById('p-blister-units').value = '1';
  document.getElementById('p-barcode').value = '';
  
  const feedback = document.getElementById('catalog-edit-feedback');
  if(feedback) feedback.remove();

  const saveBtn = document.querySelector("button[onclick='saveProduct()']");
  if(saveBtn) {
    saveBtn.innerHTML = "Guardar Producto";
    saveBtn.style.background = "";
    saveBtn.style.color = "";
  }
}
function handleDocTypeChange() {
  const docType = document.getElementById('sale-doc-type').value;
  const lblDoc = document.getElementById('lbl-cli-doc');
  const lblName = document.getElementById('lbl-cli-name');
  const txtDoc = document.getElementById('cli-doc');
  const txtName = document.getElementById('cli-name');

  if (!lblDoc || !lblName || !txtDoc || !txtName) return;

  if (docType === 'FACTURA') {
    lblDoc.innerText = "RUC de la Empresa";
    lblDoc.style.color = "#00d5ff"; // Resalta visualmente que es factura
    lblName.innerText = "Razón Social";
    txtName.placeholder = "Ej. Distribuidora VillaZar S.A.C.";
    txtDoc.placeholder = "Ej. 20123456789";
    txtDoc.maxLength = 11;
  } else {
    lblDoc.innerText = "DNI del Cliente";
    lblDoc.style.color = ""; 
    lblName.innerText = "Nombres y Apellidos";
    txtName.placeholder = "Ej. Juan Pérez";
    txtDoc.placeholder = "Ej. 74839201";
    txtDoc.maxLength = 8;
  }
}
