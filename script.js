/* ============================================================
   Advanced Family Tree App — Complete Script
============================================================ */

const LS_KEY = "familyTreeAppData_v1";
const COLORS = ["#7b5cff","#ff5cae","#5cd0ff","#ffb55c","#7CFC00","#ff7676","#a06cd5","#34d399","#facc15","#22d3ee","#fb7185","#60a5fa"];

let state = { activeFamily:null, families:{} };
let history = [], historyIndex = -1;
let svg, gMain, zoom, currentRootId = null;

/* ---------- Init ---------- */
window.addEventListener("DOMContentLoaded", () => {
  // Make sure modals are hidden on load
  document.getElementById("memberModal").hidden = true;
  document.getElementById("relationModal").hidden = true;
  document.getElementById("detailPanel").hidden = true;

  loadData();
  initSVG();
  bindEvents();
  pushHistory();
  renderAll();
});

/* ---------- Data ---------- */
function loadData(){
  const embedded = document.getElementById("embedded-data");
  if (embedded && embedded.textContent.trim() !== "null") {
    try { state = JSON.parse(embedded.textContent); return; } catch(e){}
  }
  const saved = localStorage.getItem(LS_KEY);
  if (saved) { try { state = JSON.parse(saved); return; } catch(e){} }
  initDefault();
}
function initDefault(){
  const fid = "fam_"+Date.now();
  state = { activeFamily:fid, families:{ [fid]:{ name:"My Family", members:[] } } };
}
function saveData(silent){
  localStorage.setItem(LS_KEY, JSON.stringify(state));
  if (!silent) toast("💾 Saved");
}
function getFamily(){ return state.families[state.activeFamily]; }
function getMembers(){ return getFamily().members; }

function pushHistory(){
  history = history.slice(0, historyIndex+1);
  history.push(JSON.stringify(state));
  if (history.length>50) history.shift();
  historyIndex = history.length-1;
}
function undo(){
  if (historyIndex<=0) return;
  historyIndex--;
  state = JSON.parse(history[historyIndex]);
  saveData(true); renderAll();
}
function redo(){
  if (historyIndex>=history.length-1) return;
  historyIndex++;
  state = JSON.parse(history[historyIndex]);
  saveData(true); renderAll();
}

/* ---------- SVG ---------- */
function initSVG(){
  svg = d3.select("#treeSvg");
  gMain = svg.append("g").attr("class","tree-group");
  zoom = d3.zoom().scaleExtent([0.2,3]).on("zoom", e => gMain.attr("transform", e.transform));
  svg.call(zoom);
}

/* ---------- Events ---------- */
function bindEvents(){
  document.getElementById("addMemberBtn").onclick = () => openMemberModal();
  document.getElementById("cancelModal").onclick = () => closeModal("memberModal");
  document.getElementById("memberForm").onsubmit = onSaveMember;

  document.getElementById("newFamilyBtn").onclick = () => {
    const n = prompt("Family name?");
    if (!n) return;
    const id = "fam_"+Date.now();
    state.families[id] = { name:n, members:[] };
    state.activeFamily = id;
    pushHistory(); saveData(); renderAll();
  };
  document.getElementById("renameFamilyBtn").onclick = () => {
    const n = prompt("Rename family:", getFamily().name);
    if (n) { getFamily().name=n; pushHistory(); saveData(); renderAll(); }
  };
  document.getElementById("deleteFamilyBtn").onclick = () => {
    if (Object.keys(state.families).length<=1) return alert("At least one family required.");
    if (!confirm("Delete this family?")) return;
    delete state.families[state.activeFamily];
    state.activeFamily = Object.keys(state.families)[0];
    pushHistory(); saveData(); renderAll();
  };
  document.getElementById("familySelect").onchange = e => {
    state.activeFamily = e.target.value; renderAll();
  };

  ["searchInput","filterStatus","filterLocation","filterGen"].forEach(id=>{
    document.getElementById(id).oninput = renderMemberList;
  });

  document.getElementById("undoBtn").onclick = undo;
  document.getElementById("redoBtn").onclick = redo;
  document.getElementById("saveBtn").onclick = () => saveData();

  document.getElementById("zoomIn").onclick = () => svg.transition().call(zoom.scaleBy, 1.3);
  document.getElementById("zoomOut").onclick = () => svg.transition().call(zoom.scaleBy, 0.7);
  document.getElementById("zoomReset").onclick = () => svg.transition().call(zoom.transform, d3.zoomIdentity);
  document.getElementById("backToMain").onclick = () => {
    currentRootId=null; renderTree();
    document.getElementById("backToMain").hidden=true;
    document.getElementById("breadcrumb").textContent="🏠 Main Tree";
  };

  document.getElementById("closeDetail").onclick = () => document.getElementById("detailPanel").hidden=true;

  document.getElementById("relationBtn").onclick = openRelationModal;
  document.getElementById("closeRelModal").onclick = () => closeModal("relationModal");
  document.getElementById("detectRelBtn").onclick = detectRelationship;

  document.getElementById("exportJsonBtn").onclick = exportJSON;
  document.getElementById("importJsonBtn").onclick = () => document.getElementById("importJsonInput").click();
  document.getElementById("importJsonInput").onchange = importJSON;
  document.getElementById("exportPngBtn").onclick = exportPNG;
  document.getElementById("exportPdfBtn").onclick = () => exportPDF(false);
  document.getElementById("exportMaleBtn").onclick = () => exportPDF(true);
  document.getElementById("saveForGithubBtn").onclick = saveForGithub;

  setInterval(() => saveData(true), 20000);
}

/* ---------- Member Modal ---------- */
function openMemberModal(member=null){
  document.getElementById("modalTitle").textContent = member ? "Edit Member":"Add Member";
  document.getElementById("memberId").value = member?.id || "";
  document.getElementById("fName").value = member?.name || "";
  document.getElementById("fGender").value = member?.gender || "male";
  document.getElementById("fDob").value = member?.dob || "";
  document.getElementById("fDeath").value = member?.deathDate || "";
  document.getElementById("fSpouse").value = member?.spouseName || "";
  document.getElementById("fMarriage").value = member?.marriageDate || "";
  document.getElementById("fCountry").value = member?.location?.country || "";
  document.getElementById("fState").value = member?.location?.state || "";
  document.getElementById("fCity").value = member?.location?.city || "";
  document.getElementById("fAdopted").checked = member?.isAdopted || false;
  document.getElementById("fNotes").value = member?.notes || "";
  document.getElementById("fImage").value = "";

  const psel = document.getElementById("fParent");
  const osel = document.getElementById("fOriginalParent");
  psel.innerHTML = '<option value="">— None —</option>';
  osel.innerHTML = '<option value="">— None —</option>';
  getMembers().filter(x => !member || x.id !== member.id).forEach(p => {
    psel.insertAdjacentHTML("beforeend", `<option value="${p.id}">${escapeHtml(p.name)}</option>`);
    osel.insertAdjacentHTML("beforeend", `<option value="${p.id}">${escapeHtml(p.name)}</option>`);
  });
  psel.value = member?.parentId || "";
  osel.value = member?.originalParentId || "";

  document.getElementById("memberModal").hidden = false;
}
function closeModal(id){ document.getElementById(id).hidden=true; }

async function onSaveMember(e){
  e.preventDefault();
  const id = document.getElementById("memberId").value;
  const file = document.getElementById("fImage").files[0];
  let image = null;
  if (file) image = await fileToBase64(file);

  const data = {
    id: id || "m_"+Date.now()+"_"+Math.floor(Math.random()*999),
    name: document.getElementById("fName").value.trim(),
    gender: document.getElementById("fGender").value,
    dob: document.getElementById("fDob").value,
    deathDate: document.getElementById("fDeath").value,
    parentId: document.getElementById("fParent").value || null,
    spouseName: document.getElementById("fSpouse").value,
    marriageDate: document.getElementById("fMarriage").value,
    isAdopted: document.getElementById("fAdopted").checked,
    originalParentId: document.getElementById("fOriginalParent").value || null,
    notes: document.getElementById("fNotes").value,
    location:{
      country:document.getElementById("fCountry").value,
      state:document.getElementById("fState").value,
      city:document.getElementById("fCity").value
    }
  };

  const members = getMembers();
  if (id) {
    const idx = members.findIndex(m=>m.id===id);
    data.image = image || members[idx].image;
    data.color = members[idx].color;
    members[idx] = data;
  } else {
    data.image = image;
    data.color = COLORS[members.length % COLORS.length];
    members.push(data);
  }
  pushHistory(); saveData(); closeModal("memberModal"); renderAll();
}

function fileToBase64(file){
  return new Promise(res => { const r=new FileReader(); r.onload=()=>res(r.result); r.readAsDataURL(file); });
}

/* ---------- Render ---------- */
function renderAll(){
  renderFamilySelect();
  renderMemberList();
  renderTree();
  renderStats();
}
function renderFamilySelect(){
  const sel = document.getElementById("familySelect");
  sel.innerHTML = "";
  Object.entries(state.families).forEach(([id,f])=>{
    sel.insertAdjacentHTML("beforeend", `<option value="${id}" ${id===state.activeFamily?"selected":""}>${escapeHtml(f.name)}</option>`);
  });
}
function renderMemberList(){
  const list = document.getElementById("memberList");
  const q = document.getElementById("searchInput").value.toLowerCase();
  const status = document.getElementById("filterStatus").value;
  const loc = document.getElementById("filterLocation").value.toLowerCase();
  const gen = parseInt(document.getElementById("filterGen").value);
  const generations = computeGenerations();

  list.innerHTML = "";
  getMembers().forEach(m => {
    const isAlive = !m.deathDate;
    if (q && !m.name.toLowerCase().includes(q)) return;
    if (status==="alive" && !isAlive) return;
    if (status==="deceased" && isAlive) return;
    if (loc) {
      const all = `${m.location?.country||""} ${m.location?.state||""} ${m.location?.city||""}`.toLowerCase();
      if (!all.includes(loc)) return;
    }
    if (gen && generations[m.id]!==gen) return;
    list.insertAdjacentHTML("beforeend", `<div class="item" data-id="${m.id}">${escapeHtml(m.name)} <small>(${isAlive?"Alive":"†"})</small></div>`);
  });
  list.querySelectorAll(".item").forEach(el => {
    el.onclick = () => openDetail(el.dataset.id);
  });
}
function renderStats(){
  const m = getMembers();
  document.getElementById("statTotal").textContent = m.length;
  const gens = computeGenerations();
  const maxGen = Object.values(gens).length ? Math.max(...Object.values(gens)) : 0;
  document.getElementById("statGen").textContent = maxGen;
  document.getElementById("statAlive").textContent = m.filter(x=>!x.deathDate).length;
  document.getElementById("statBirthdays").textContent = upcomingBirthdays();
}
function upcomingBirthdays(){
  const today = new Date(); const in30 = new Date(); in30.setDate(today.getDate()+30);
  return getMembers().filter(m=>{
    if (!m.dob || m.deathDate) return false;
    const d = new Date(m.dob); d.setFullYear(today.getFullYear());
    return d>=today && d<=in30;
  }).length;
}

/* ---------- Generations ---------- */
function computeGenerations(){
  const gens = {};
  const members = getMembers();
  function calc(id){
    if (gens[id]) return gens[id];
    const m = members.find(x=>x.id===id);
    if (!m) return 0;
    if (!m.parentId) return gens[id]=1;
    return gens[id] = calc(m.parentId)+1;
  }
  members.forEach(m=>calc(m.id));
  return gens;
}

/* ---------- Tree Build ---------- */
function buildHierarchy(rootId=null){
  const members = getMembers();
  if (!members.length) return null;

  let roots;
  if (rootId) {
    const r = members.find(m=>m.id===rootId);
    if (!r) return null;
    roots = [r];
  } else {
    roots = members.filter(m => !m.parentId);
    if (!roots.length) roots = [members[0]];
  }

  function build(node){
    const children = members.filter(m => m.parentId === node.id || (m.isAdopted && m.originalParentId === node.id));
    return { ...node, children: children.map(build) };
  }

  if (roots.length === 1) return build(roots[0]);
  return { id:"__virtual_root__", name:"Family", virtual:true, children: roots.map(build) };
}

function renderTree(){
  gMain.selectAll("*").remove();
  const root = buildHierarchy(currentRootId);
  if (!root) {
    gMain.append("text").attr("x",400).attr("y",200).attr("fill","#888").attr("font-size","18").text("No members yet. Click 'Add Member' to begin.");
    return;
  }

  const hierarchy = d3.hierarchy(root);
  const nodeW = 160, nodeH = 90;
  const treeLayout = d3.tree().nodeSize([nodeW+20, nodeH+60]);
  treeLayout(hierarchy);

  const nodes = hierarchy.descendants().filter(d => !d.data.virtual);
  const links = hierarchy.links().filter(l => !l.source.data.virtual);

  // center
  const w = svg.node().clientWidth;
  gMain.attr("transform", `translate(${w/2}, 80)`);

  // Links
  gMain.selectAll(".link").data(links).enter().append("path")
    .attr("class", d => d.target.data.isAdopted ? "link adopt" : "link")
    .attr("d", d => `M${d.source.x},${d.source.y+nodeH/2} C${d.source.x},${(d.source.y+d.target.y)/2} ${d.target.x},${(d.source.y+d.target.y)/2} ${d.target.x},${d.target.y-nodeH/2}`);

  // Nodes
  const node = gMain.selectAll(".node-card").data(nodes).enter().append("g")
    .attr("class","node-card")
    .attr("transform", d => `translate(${d.x-nodeW/2},${d.y-nodeH/2})`)
    .on("click", (e,d) => openDetail(d.data.id));

  node.append("rect")
    .attr("width", nodeW).attr("height", nodeH)
    .attr("rx",12).attr("ry",12)
    .attr("fill", d => d.data.color || "#7b5cff")
    .attr("stroke", d => d.data.gender==="female" ? "#ff5cae" : "#5cd0ff");

  // Profile circle
  node.append("circle")
    .attr("cx", 25).attr("cy", nodeH/2).attr("r", 22)
    .attr("fill", "#fff").attr("stroke","#fff").attr("stroke-width",2);

  node.filter(d=>d.data.image).append("image")
    .attr("href", d => d.data.image)
    .attr("x", 3).attr("y", nodeH/2-22)
    .attr("width", 44).attr("height", 44)
    .attr("clip-path", "circle(22px at 22px 22px)");

  node.filter(d=>!d.data.image).append("text")
    .attr("x", 25).attr("y", nodeH/2+5)
    .attr("text-anchor","middle").attr("fill","#333").attr("font-size","18")
    .text(d => (d.data.name||"?").charAt(0).toUpperCase());

  // Name
  node.append("text")
    .attr("x", 55).attr("y", 25).attr("font-weight","bold")
    .text(d => truncate(d.data.name, 14));

  // Years
  node.append("text")
    .attr("x", 55).attr("y", 42).attr("font-size","10").attr("fill","#eee")
    .text(d => {
      const b = d.data.dob ? new Date(d.data.dob).getFullYear() : "?";
      const dt = d.data.deathDate ? new Date(d.data.deathDate).getFullYear() : "";
      return dt ? `${b} – ${dt}` : `b. ${b}`;
    });

  // Location
  node.append("text")
    .attr("x", 55).attr("y", 58).attr("font-size","9").attr("fill","#ddd")
    .text(d => d.data.location?.city ? `📍 ${truncate(d.data.location.city,12)}` : "");

  // Gender + spouse
  node.append("text")
    .attr("x", 55).attr("y", 74).attr("font-size","9").attr("fill","#ddd")
    .text(d => `${d.data.gender==="male"?"♂":d.data.gender==="female"?"♀":"⚧"} ${d.data.spouseName ? "💍 "+truncate(d.data.spouseName,10):""}`);

  // Generation badge
  const gens = computeGenerations();
  node.append("circle").attr("class","gen-badge").attr("cx", nodeW-12).attr("cy", 12).attr("r",10).attr("fill","rgba(0,0,0,0.5)");
  node.append("text").attr("x", nodeW-12).attr("y", 16).attr("text-anchor","middle").attr("font-size","10").attr("fill","#fff")
    .text(d => "G"+(gens[d.data.id]||"?"));

  // Adopted badge
  node.filter(d=>d.data.isAdopted).append("text")
    .attr("class","adopt-badge").attr("x", nodeW-15).attr("y", nodeH-8).attr("text-anchor","end")
    .text("ADOPTED");

  // Tooltips
  node.append("title").text(d => `${d.data.name}\n${d.data.notes||""}`);
}

function truncate(str, n){ if (!str) return ""; return str.length>n ? str.slice(0,n)+"…" : str; }

/* ---------- Detail Panel ---------- */
function openDetail(id){
  const m = getMembers().find(x => x.id===id);
  if (!m) return;
  const parent = m.parentId ? getMembers().find(x=>x.id===m.parentId) : null;
  const orig = m.originalParentId ? getMembers().find(x=>x.id===m.originalParentId) : null;
  const children = getMembers().filter(x => x.parentId===id);

  const c = document.getElementById("detailContent");
  c.innerHTML = `
    ${m.image ? `<img src="${m.image}" class="profile"/>` : `<div class="profile" style="background:${m.color};display:flex;align-items:center;justify-content:center;font-size:46px;color:#fff;">${(m.name||"?").charAt(0)}</div>`}
    <h2>${escapeHtml(m.name)}</h2>
    <div class="info"><b>Gender:</b> ${m.gender}</div>
    <div class="info"><b>DOB:</b> ${m.dob||"—"}</div>
    <div class="info"><b>Death:</b> ${m.deathDate||"—"}</div>
    <div class="info"><b>Spouse:</b> ${escapeHtml(m.spouseName||"—")}</div>
    <div class="info"><b>Marriage Date:</b> ${m.marriageDate||"—"}</div>
    <div class="info"><b>Parent:</b> ${parent?escapeHtml(parent.name):"—"}</div>
    ${m.isAdopted?`<div class="info"><b>Biological Parent:</b> ${orig?escapeHtml(orig.name):"Unknown"}</div>`:""}
    <div class="info"><b>Location:</b> ${escapeHtml([m.location?.city,m.location?.state,m.location?.country].filter(Boolean).join(", ")||"—")}</div>
    <div class="info"><b>Children:</b> ${children.length ? children.map(c=>escapeHtml(c.name)).join(", ") : "—"}</div>
    <div class="info"><b>Notes:</b><br>${escapeHtml(m.notes||"—")}</div>
    <div class="btns">
      <button class="primary" onclick="viewSubtree('${m.id}')">🌳 View Family Chart</button>
      <button onclick="editMember('${m.id}')">✏ Edit</button>
      <button class="danger" onclick="deleteMember('${m.id}')">🗑 Delete</button>
    </div>
  `;
  document.getElementById("detailPanel").hidden = false;
}
function viewSubtree(id){
  currentRootId = id;
  const m = getMembers().find(x=>x.id===id);
  document.getElementById("breadcrumb").textContent = "🌳 " + m.name + " — Subtree";
  document.getElementById("backToMain").hidden = false;
  document.getElementById("detailPanel").hidden = true;
  renderTree();
}
function editMember(id){
  const m = getMembers().find(x=>x.id===id);
  if (m) openMemberModal(m);
  document.getElementById("detailPanel").hidden = true;
}
function deleteMember(id){
  if (!confirm("Delete this member? Children will become orphaned (parent removed).")) return;
  const members = getMembers();
  const idx = members.findIndex(m=>m.id===id);
  if (idx<0) return;
  members.splice(idx,1);
  // Clear references
  members.forEach(m=>{
    if (m.parentId===id) m.parentId=null;
    if (m.originalParentId===id) m.originalParentId=null;
  });
  pushHistory(); saveData();
  document.getElementById("detailPanel").hidden = true;
  renderAll();
}

/* ---------- Relationship Detection ---------- */
function openRelationModal(){
  const a = document.getElementById("relA");
  const b = document.getElementById("relB");
  a.innerHTML = b.innerHTML = "";
  getMembers().forEach(m=>{
    a.insertAdjacentHTML("beforeend", `<option value="${m.id}">${escapeHtml(m.name)}</option>`);
    b.insertAdjacentHTML("beforeend", `<option value="${m.id}">${escapeHtml(m.name)}</option>`);
  });
  document.getElementById("relResult").textContent = "";
  document.getElementById("relationModal").hidden = false;
}
function detectRelationship(){
  const aId = document.getElementById("relA").value;
  const bId = document.getElementById("relB").value;
  if (!aId || !bId) return;
  if (aId===bId) { document.getElementById("relResult").textContent = "Same person."; return; }
  const rel = computeRelationship(aId, bId);
  document.getElementById("relResult").textContent = "→ " + rel;
}
function getAncestors(id){
  const members = getMembers();
  const list = [];
  let cur = members.find(m=>m.id===id);
  let level = 0;
  while (cur && cur.parentId) {
    level++;
    const p = members.find(m=>m.id===cur.parentId);
    if (!p) break;
    list.push({id:p.id, level, gender:p.gender});
    cur = p;
  }
  return list;
}
function computeRelationship(aId, bId){
  const members = getMembers();
  const A = members.find(m=>m.id===aId);
  const B = members.find(m=>m.id===bId);
  if (!A||!B) return "Unknown";

  if (B.parentId===aId) return A.gender==="female"?"Mother of "+B.name:"Father of "+B.name;
  if (A.parentId===bId) return B.gender==="female"?"Mother of "+A.name:"Father of "+A.name;

  if (A.parentId && A.parentId===B.parentId) return A.gender==="female"?"Sister":"Brother";

  const ancA = getAncestors(aId);
  const ancB = getAncestors(bId);

  // Common ancestor
  for (const x of ancA) for (const y of ancB) {
    if (x.id===y.id) {
      const la=x.level, lb=y.level;
      if (la===1 && lb===2) return A.gender==="female"?"Aunt":"Uncle";
      if (la===2 && lb===1) return B.gender==="female"?"Aunt":"Uncle";
      if (la===2 && lb===2) return "Cousins";
      if (la>=2 && lb===0) return "Grandparent / Ancestor";
      if (la===0 && lb>=2) return "Descendant";
      if (la>2 && lb>2) return `Distant cousins (${la}×${lb})`;
      return `Related via ${members.find(m=>m.id===x.id)?.name}`;
    }
  }
  return "No direct blood relationship found";
}

/* ---------- Export / Import ---------- */
function exportJSON(){
  const blob = new Blob([JSON.stringify(state,null,2)], {type:"application/json"});
  download(blob, "family-tree.json");
}
function importJSON(e){
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      state = JSON.parse(r.result);
      pushHistory(); saveData(); renderAll();
      toast("✅ Imported");
    } catch(err){ alert("Invalid JSON file"); }
  };
  r.readAsText(f);
}
function download(blob, name){
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
}

/* ---------- PNG Export ---------- */
function exportPNG(){
  const svgNode = document.getElementById("treeSvg");
  const serializer = new XMLSerializer();
  // Clone SVG and inline transform/contents
  const clone = svgNode.cloneNode(true);
  const w = svgNode.clientWidth, h = svgNode.clientHeight;
  clone.setAttribute("width", w); clone.setAttribute("height", h);
  clone.setAttribute("xmlns","http://www.w3.org/2000/svg");
  const svgString = serializer.serializeToString(clone);
  const img = new Image();
  const blob = new Blob([svgString], {type:"image/svg+xml;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  img.onload = function(){
    const canvas = document.createElement("canvas");
    canvas.width = w*2; canvas.height = h*2;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#0f1226";
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(img,0,0,canvas.width,canvas.height);
    canvas.toBlob(b => download(b, "family-tree.png"));
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

/* ---------- PDF Export ---------- */
async function exportPDF(maleOnly){
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF("l","mm","a4");
  const w = pdf.internal.pageSize.getWidth();
  const h = pdf.internal.pageSize.getHeight();

  // Title
  pdf.setFontSize(20);
  pdf.text(getFamily().name + (maleOnly?" — Male Lineage":""), w/2, 15, {align:"center"});

  // Capture tree as image
  const svgNode = document.getElementById("treeSvg");
  const serializer = new XMLSerializer();
  const clone = svgNode.cloneNode(