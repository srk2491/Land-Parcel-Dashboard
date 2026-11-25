(function () {
  "use strict";
  var state = { page: "overview", parcels: [], data: null, search: "", constituency: "all", taluk: "all", status: "all", sort: "id", selected: null, toastTimer: null };
  var $ = function (selector) { return document.querySelector(selector); };
  var $$ = function (selector) { return Array.prototype.slice.call(document.querySelectorAll(selector)); };
  var statusNames = {};
  function areaInGuntas(p) { return Number(p.areaAcres || 0) * 40 + Number(p.areaGuntas || 0); }
  function formatExtent(acres, guntas) { return Number(acres || 0) + " ac " + Number(guntas || 0) + " g"; }
  function normalizedArea(acres, guntas) {
    var total = Number(acres || 0) * 40 + Number(guntas || 0);
    return { acres: Math.floor(total / 40), guntas: total % 40 };
  }
  function formatNormalized(acres, guntas) {
    var a = normalizedArea(acres, guntas);
    return a.acres + " ac " + a.guntas + " g";
  }
  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }
  function showToast(message) {
    var toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(function () { toast.classList.remove("show"); }, 2600);
  }
  function setPage(page) {
    state.page = page;
    $("#overview-page").classList.toggle("hidden", page !== "overview");
    $("#parcels-page").classList.toggle("hidden", page !== "parcels");
    $$(".nav-item").forEach(function (button) {
      var active = button.getAttribute("data-page") === page;
      button.classList.toggle("active", active);
      if (active) button.setAttribute("aria-current", "page"); else button.removeAttribute("aria-current");
    });
    $("#crumb-current").textContent = page === "overview" ? "Overview" : "Parcel register";
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (page === "parcels") $("#search-input").focus({ preventScroll: true });
  }
  function getStatus(p, key) {
    return (p.statusExtents || []).find(function (entry) { return entry.key === key; });
  }
  function renderSummary() {
    var summary = state.data.summary;
    $("#parcel-count").textContent = summary.parcelCount.toLocaleString("en-IN");
    $("#nav-count").textContent = summary.parcelCount.toLocaleString("en-IN");
    $("#total-area").textContent = formatExtent(summary.normalizedAcres, summary.normalizedGuntas);
    var available = summary.statusTotals.available;
    $("#available-count").textContent = available.parcelCount.toLocaleString("en-IN");
    $("#available-area").textContent = formatNormalized(available.acres, available.guntas) + " recorded in that column";
    $("#photo-count").textContent = state.parcels.filter(function (p) { return Boolean(p.photo); }).length.toLocaleString("en-IN");
    renderConstituencyChart();
    renderStatusChart();
    renderLargest();
  }
  function renderConstituencyChart() {
    var groups = {};
    state.parcels.forEach(function (p) {
      var key = p.constituency || "Not shown";
      groups[key] = groups[key] || { count: 0, guntas: 0 };
      groups[key].count += 1;
      groups[key].guntas += areaInGuntas(p);
    });
    var rows = Object.keys(groups).map(function (name) { return { name: name, count: groups[name].count, guntas: groups[name].guntas }; }).sort(function (a,b) { return b.guntas - a.guntas; });
    var max = Math.max.apply(null, rows.map(function (r) { return r.guntas; })) || 1;
    $("#constituency-chart").innerHTML = rows.map(function (r) {
      return '<div class="constituency-row"><div class="constituency-name" title="' + escapeHtml(r.name) + '">' + escapeHtml(r.name) + '</div><div class="bar-track"><div class="bar-fill" style="width:' + Math.max(2,Math.round(r.guntas/max*100)) + '%"></div></div><div class="constituency-total"><strong>' + r.count + '</strong> parcels · ' + formatNormalized(Math.floor(r.guntas/40),r.guntas%40) + '</div></div>';
    }).join("");
  }
  function renderStatusChart() {
    var totals = state.data.summary.statusTotals;
    var rows = state.data.statusCategories.map(function (category) {
      return { key: category.key, label: category.label, count: totals[category.key] ? totals[category.key].parcelCount : 0 };
    }).filter(function (row) { return row.count > 0; });
    var max = Math.max.apply(null, rows.map(function (r) { return r.count; })) || 1;
    $("#status-chart").innerHTML = rows.map(function (r) {
      return '<div class="status-item"><div class="status-item-top"><span class="status-name">' + escapeHtml(r.label) + '</span><strong class="status-count">' + r.count + '</strong></div><div class="status-track"><div class="status-fill" style="width:' + Math.max(2,Math.round(r.count/max*100)) + '%"></div></div></div>';
    }).join("");
  }
  function renderLargest() {
    var largest = state.parcels.slice().sort(function (a,b) { return areaInGuntas(b)-areaInGuntas(a); }).slice(0,5);
    $("#largest-list").innerHTML = largest.map(function (p) {
      return '<button type="button" class="largest-row" data-open-id="' + p.id + '"><span class="parcel-number">' + String(p.id).padStart(2,"0") + '</span><span><span class="largest-village">' + escapeHtml(p.village) + '</span><span class="largest-location">' + escapeHtml(p.constituency) + ' · ' + escapeHtml(p.taluk) + ' · Survey ' + escapeHtml(p.surveyNo) + '</span></span><span class="largest-area">' + formatExtent(p.areaAcres,p.areaGuntas) + '</span></button>';
    }).join("");
    $$("[data-open-id]").forEach(function (button) { button.addEventListener("click",function () { openParcel(Number(button.getAttribute("data-open-id"))); }); });
  }
  function fillFilters() {
    var constituencies = Array.from(new Set(state.parcels.map(function (p) { return p.constituency; }))).sort();
    var taluks = Array.from(new Set(state.parcels.map(function (p) { return p.taluk; }))).sort();
    $("#constituency-filter").innerHTML = '<option value="all">All constituencies</option>' + constituencies.map(function (v) { return '<option value="' + escapeHtml(v) + '">' + escapeHtml(v) + '</option>'; }).join("");
    $("#taluk-filter").innerHTML = '<option value="all">All taluks</option>' + taluks.map(function (v) { return '<option value="' + escapeHtml(v) + '">' + escapeHtml(v) + '</option>'; }).join("");
    $("#status-filter").innerHTML = '<option value="all">All status tags</option>' + state.data.statusCategories.filter(function (v) { return state.data.summary.statusTotals[v.key] && state.data.summary.statusTotals[v.key].parcelCount > 0; }).map(function (v) { return '<option value="' + escapeHtml(v.key) + '">' + escapeHtml(v.label) + '</option>'; }).join("");
    state.data.statusCategories.forEach(function (entry) { statusNames[entry.key] = entry.label; });
  }
  function filteredParcels() {
    var search = state.search.trim().toLocaleLowerCase();
    var result = state.parcels.filter(function (p) {
      var matchesSearch = !search || [p.id,p.constituency,p.taluk,p.hobli,p.village,p.surveyNo].join(" ").toLocaleLowerCase().indexOf(search) >= 0;
      var matchesConstituency = state.constituency === "all" || p.constituency === state.constituency;
      var matchesTaluk = state.taluk === "all" || p.taluk === state.taluk;
      var matchesStatus = state.status === "all" || (p.statusExtents || []).some(function (entry) { return entry.key === state.status; });
      return matchesSearch && matchesConstituency && matchesTaluk && matchesStatus;
    });
    if (state.sort === "area-desc") result.sort(function (a,b) { return areaInGuntas(b)-areaInGuntas(a); });
    else if (state.sort === "area-asc") result.sort(function (a,b) { return areaInGuntas(a)-areaInGuntas(b); });
    else if (state.sort === "village") result.sort(function (a,b) { return a.village.localeCompare(b.village); });
    else result.sort(function (a,b) { return a.id-b.id; });
    return result;
  }
  function statusChips(p, limit) {
    var entries = p.statusExtents || [];
    if (!entries.length) return '<span class="location-sub">No status extent entered</span>';
    return entries.slice(0,limit || 2).map(function (entry) {
      return '<span class="status-chip ' + escapeHtml(entry.key) + '" title="' + escapeHtml(entry.label + ': ' + formatExtent(entry.acres,entry.guntas)) + '">' + escapeHtml(entry.label) + '</span>';
    }).join("") + (entries.length > (limit || 2) ? '<span class="status-chip">+' + (entries.length-(limit || 2)) + '</span>' : "");
  }
  function renderRows() {
    var rows = filteredParcels();
    $("#result-count").textContent = rows.length + (rows.length === 1 ? " parcel shown" : " parcels shown");
    $("#table-footer-count").textContent = "Showing " + rows.length + " of " + state.parcels.length + " parcels";
    var hasFilters = Boolean(state.search || state.constituency !== "all" || state.taluk !== "all" || state.status !== "all");
    $("#clear-filters").classList.toggle("hidden",!hasFilters);
    $("#empty-state").classList.toggle("hidden",rows.length !== 0);
    $(".parcel-table").classList.toggle("hidden",rows.length === 0);
    $("#parcel-table-body").innerHTML = rows.map(function (p) {
      var location = '<div class="location-main">' + escapeHtml(p.village) + '</div><div class="location-sub">' + escapeHtml(p.hobli) + ' hobli · ' + escapeHtml(p.taluk) + ' taluk</div>';
      return '<tr class="parcel-row" data-open-id="' + p.id + '" tabindex="0" aria-label="Open parcel ' + p.id + ', ' + escapeHtml(p.village) + ', survey ' + escapeHtml(p.surveyNo) + '"><td class="id-cell">' + String(p.id).padStart(3,"0") + '</td><td>' + location + '</td><td class="survey-cell">' + escapeHtml(p.surveyNo) + '</td><td class="constituency-cell">' + escapeHtml(p.constituency) + '</td><td class="area-cell">' + formatExtent(p.areaAcres,p.areaGuntas) + '</td><td><div class="status-chips">' + statusChips(p,2) + '</div></td><td class="photo-cell"><img class="photo-thumb" src="' + escapeHtml(p.photo) + '" alt="GPS photo for parcel ' + p.id + '" loading="lazy"></td></tr>';
    }).join("");
    $$(".parcel-row").forEach(function (row) {
      row.addEventListener("click",function () { openParcel(Number(row.getAttribute("data-open-id"))); });
      row.addEventListener("keydown",function (event) { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openParcel(Number(row.getAttribute("data-open-id"))); } });
    });
  }
  function formatBytes(bytes) {
    if (!bytes) return "0 B";
    var units = ["B", "KB", "MB", "GB"];
    var value = Number(bytes);
    var unit = 0;
    while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
    return value.toFixed(unit === 0 ? 0 : 1) + " " + units[unit];
  }
  function loadParcelMedia(parcelId) {
    var target = $("#field-media");
    if (!target) return;
    target.innerHTML = '<p class="media-loading">Loading site photos and videos…</p>';
    var media = window.LandParcelMedia;
    if (!media || !media.ready()) {
      target.innerHTML = '<p class="media-error">Online media storage is not configured yet.</p>';
      return;
    }
    Promise.all([media.list(parcelId), media.getAccess()]).then(function (results) {
      renderParcelMedia(parcelId, results[0], results[1]);
    }).catch(function (error) {
      if (state.selected && state.selected.id === parcelId) {
        target.innerHTML = '<p class="media-error">' + escapeHtml(error && error.message ? error.message : "The media library could not be loaded.") + '</p>';
      }
    });
  }
  function renderParcelMedia(parcelId, items, access) {
    if (!state.selected || state.selected.id !== parcelId) return;
    items = Array.isArray(items) ? items : [];
    access = access || {};
    var cards = items.map(function (item) {
      var url = escapeHtml(item.url || "");
      var preview = item.mediaType === "video"
        ? '<video controls preload="metadata" src="' + url + '" aria-label="Video for parcel ' + parcelId + '"></video>'
        : '<a href="' + url + '" target="_blank" rel="noreferrer"><img src="' + url + '" alt="Uploaded site photo: ' + escapeHtml(item.fileName) + '" loading="lazy"></a>';
      return '<article class="media-card">' + preview + '<div class="media-card-info"><strong title="' + escapeHtml(item.fileName) + '">' + escapeHtml(item.fileName) + '</strong><span>' + (item.mediaType === "video" ? "Video" : "Photo") + ' · ' + formatBytes(item.sizeBytes) + '</span></div></article>';
    }).join("");
    var managerUrl = './media-admin.html?parcel=' + encodeURIComponent(parcelId);
    var editor = access.isAdmin
      ? '<a class="media-signin" href="' + escapeHtml(managerUrl) + '" target="_top">Manage parcel media</a>'
      : (access.signedIn
        ? '<p class="media-readonly">Media editing is restricted to approved editors.</p>'
        : '<a class="media-signin" href="' + escapeHtml(managerUrl) + '" target="_top">Sign in to upload photos or videos</a>');
    var empty = items.length ? '' : '<p class="media-empty">No high-resolution photos or videos have been uploaded for this parcel yet.</p>';
    $("#field-media").innerHTML = '<p class="media-visibility-note">Uploaded media is visible to anyone who can open this dashboard.</p>' + (items.length ? '<div class="media-gallery">' + cards + '</div>' : empty) + editor;
  }

  function loadParcelNotes(parcelId) {
    var target = $("#field-notes");
    if (!target) return;
    target.innerHTML = '<p class="media-loading">Loading site notes…</p>';
    var media = window.LandParcelMedia;
    if (!media || !media.ready() || typeof media.listNotes !== "function") {
      target.innerHTML = '<p class="media-error">Online notes storage is not configured yet.</p>';
      return;
    }
    Promise.all([media.listNotes(parcelId), media.getAccess()]).then(function (results) {
      renderParcelNotes(parcelId, results[0], results[1]);
    }).catch(function (error) {
      if (state.selected && state.selected.id === parcelId) {
        target.innerHTML = '<p class="media-error">Could not load site notes. Confirm the notes SQL setup has been run in Supabase.</p><p class="media-error">' + escapeHtml(error && error.message ? error.message : "The notes library could not be loaded.") + '</p>';
      }
    });
  }
  function renderParcelNotes(parcelId, items, access) {
    if (!state.selected || state.selected.id !== parcelId) return;
    var media = window.LandParcelMedia;
    items = Array.isArray(items) ? items : [];
    access = access || {};
    var notes = items.map(function (item) {
      var createdAt = item.createdAt ? new Date(item.createdAt) : null;
      var dateText = createdAt && !Number.isNaN(createdAt.getTime())
        ? createdAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
        : "";
      return '<article class="site-note"><time class="site-note-meta" datetime="' + escapeHtml(item.createdAt || "") + '">' + escapeHtml(dateText) + '</time><p class="site-note-body">' + escapeHtml(item.note) + '</p></article>';
    }).join("");
    var managerUrl = './media-admin.html?parcel=' + encodeURIComponent(parcelId);
    var editor = access.isAdmin
      ? '<form id="site-note-form" class="site-note-form"><label for="site-note-input">Add a note</label><textarea id="site-note-input" name="note" rows="4" maxlength="5000" placeholder="Write an update about this site…" required></textarea><div class="site-note-form-footer"><span>Up to 5,000 characters</span><button type="submit">Save note</button></div><p id="site-note-status" class="site-note-status" role="status" aria-live="polite"></p></form>'
      : (access.signedIn
        ? '<p class="media-readonly">Only approved editors can add notes.</p>'
        : '<a class="media-signin" href="' + escapeHtml(managerUrl) + '" target="_top">Sign in to add a note</a>');
    var empty = items.length ? "" : '<p class="media-empty">No notes have been added for this site yet.</p>';
    $("#field-notes").innerHTML = '<p class="site-notes-visibility">Notes are shared with everyone who can view this dashboard. Avoid adding personal or confidential information.</p>' +
      (items.length ? '<div class="site-note-list">' + notes + '</div>' : empty) + editor;
    var form = $("#site-note-form");
    if (form) form.addEventListener("submit", async function (event) {
      event.preventDefault();
      var input = $("#site-note-input");
      var status = $("#site-note-status");
      var button = form.querySelector('button[type="submit"]');
      var note = input.value.trim();
      if (!note) { status.textContent = "Write a note before saving."; return; }
      button.disabled = true;
      status.textContent = "Saving note…";
      try {
        await media.addNote(parcelId, note);
        showToast("Note added to this site");
        await loadParcelNotes(parcelId);
      } catch (error) {
        status.textContent = error && error.message ? error.message : "Could not save this note.";
        button.disabled = false;
      }
    });
  }
  function uploadPart(url, blob, onProgress) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open("PUT", url);
      xhr.setRequestHeader("Content-Type", "application/octet-stream");
      xhr.upload.addEventListener("progress", function (event) { if (event.lengthComputable) onProgress(event.loaded, event.total); });
      xhr.onload = function () {
        var result;
        try { result = JSON.parse(xhr.responseText); } catch (_) { result = {}; }
        if (xhr.status < 200 || xhr.status >= 300) reject(new Error(result.error || "A video or photo part failed to upload"));
        else resolve(result);
      };
      xhr.onerror = function () { reject(new Error("Network error while uploading media")); };
      xhr.send(blob);
    });
  }
  async function uploadMediaFiles(files, parcelId, replaceId) {
    var status = $("#media-upload-status");
    var progress = $("#media-progress");
    if (!files.length || !status || !progress) return;
    var maxBytes = 1024 * 1024 * 1024;
    for (var f = 0; f < files.length; f += 1) {
      var file = files[f];
      if (file.size > maxBytes) { status.textContent = file.name + " is larger than 1 GB."; continue; }
      status.textContent = "Preparing " + file.name + "…";
      progress.hidden = false; progress.max = file.size; progress.value = 0;
      var session = null;
      try {
        var initResponse = await fetch("/api/media/upload/init", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ parcelId: parcelId, fileName: file.name, mimeType: file.type, sizeBytes: file.size, replaceId: replaceId }) });
        var init = await initResponse.json();
        if (!initResponse.ok) throw new Error(init.error || "Could not start upload");
        session = init;
        var parts = [];
        var partSize = Number(init.partSize) || 8 * 1024 * 1024;
        var uploadedBefore = 0;
        for (var start = 0, partNumber = 1; start < file.size; start += partSize, partNumber += 1) {
          var chunk = file.slice(start, Math.min(start + partSize, file.size));
          status.textContent = "Uploading " + file.name + " · part " + partNumber + " of " + Math.ceil(file.size / partSize);
          var part = await uploadPart("/api/media/upload/part?key=" + encodeURIComponent(init.key) + "&uploadId=" + encodeURIComponent(init.uploadId) + "&partNumber=" + partNumber, chunk, function (loaded) { progress.value = Math.min(file.size, uploadedBefore + loaded); });
          parts.push({ partNumber: partNumber, etag: part.etag });
          uploadedBefore += chunk.size; progress.value = uploadedBefore;
        }
        var completeResponse = await fetch("/api/media/upload/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ parcelId: parcelId, key: init.key, uploadId: init.uploadId, fileName: file.name, mimeType: file.type, sizeBytes: file.size, replaceId: replaceId, parts: parts }) });
        var completed = await completeResponse.json();
        if (!completeResponse.ok) throw new Error(completed.error || "Could not finish upload");
        status.textContent = "Saved " + file.name;
        replaceId = null;
      } catch (error) {
        if (session) fetch("/api/media/upload/abort", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: session.key, uploadId: session.uploadId }) }).catch(function () {});
        status.textContent = error.message || "Upload failed. Try again.";
        showToast(status.textContent);
        continue;
      }
    }
    progress.hidden = true;
    loadParcelMedia(parcelId);
  }
  function renderDrawer(p) {
    var statuses = (p.statusExtents || []).length ? p.statusExtents.map(function (entry) {
      return '<div class="drawer-status"><span class="drawer-status-name">' + escapeHtml(entry.label) + '</span><span class="drawer-status-area">' + formatExtent(entry.acres,entry.guntas) + '</span></div>';
    }).join("") : '<div class="drawer-status"><span class="drawer-status-name">No status extent entered</span></div>';
    $("#drawer-content").innerHTML = '<div class="drawer-content">' +
      '<div class="drawer-title-row"><div><div class="drawer-id">REGISTER NO. ' + String(p.id).padStart(3,"0") + '</div><h2 class="drawer-title">' + escapeHtml(p.village) + '</h2><p class="drawer-subtitle">' + escapeHtml(p.hobli) + ' hobli · ' + escapeHtml(p.taluk) + ' taluk</p></div></div>' +
      '<div class="drawer-area"><div><span>Reported parcel extent</span><strong>' + formatExtent(p.areaAcres,p.areaGuntas) + '</strong></div><small>Source page ' + p.page + '</small></div>' +
      '<div class="detail-grid">' +
        '<div class="detail-field"><div class="detail-label">Survey number</div><div class="detail-value">' + escapeHtml(p.surveyNo) + '</div></div>' +
        '<div class="detail-field"><div class="detail-label">Assembly constituency</div><div class="detail-value">' + escapeHtml(p.constituency) + '</div></div>' +
        '<div class="detail-field"><div class="detail-label">Taluk</div><div class="detail-value">' + escapeHtml(p.taluk) + '</div></div>' +
        '<div class="detail-field"><div class="detail-label">Hobli</div><div class="detail-value">' + escapeHtml(p.hobli) + '</div></div>' +
      '</div>' +
      '<section class="drawer-section"><div class="drawer-section-head"><h3>Status extents recorded</h3><span>as entered in PDF</span></div><div class="drawer-status-list">' + statuses + '</div><p class="source-caption">Status amounts are copied from their source columns. They may not reconcile with the parcel extent.</p></section>' +
      '<section class="drawer-section media-library-section"><div class="drawer-section-head"><h3>Site photos &amp; videos</h3><span>High-resolution uploads</span></div><div id="field-media"><p class="media-loading">Loading site photos and videos…</p></div></section>' +
      '<section class="drawer-section site-notes-section"><div class="drawer-section-head"><h3>Site notes</h3><span>Shared parcel log</span></div><div id="field-notes"><p class="media-loading">Loading site notes…</p></div></section>' +
      '<section class="drawer-section"><div class="drawer-section-head"><h3>GPS site photograph from PDF</h3><span>PDF row ' + String(p.id).padStart(3,"0") + '</span></div><img class="source-photo" src="' + escapeHtml(p.photo) + '" alt="Source GPS photo for ' + escapeHtml(p.village) + '"></section>' +
      '<section class="drawer-section"><div class="drawer-section-head"><h3>Source row</h3><span>page ' + p.page + ' of 8</span></div><img class="source-row-image" src="' + escapeHtml(p.sourceRow) + '" alt="Original source row for parcel ' + p.id + ' on page ' + p.page + '"><p class="source-caption">The source row retains the Kannada locality spelling and the full remarks printed in the PDF.</p><a class="drawer-source-link" href="./source/land-details-20-11-2026.pdf#page=' + p.page + '" target="_blank" rel="noreferrer">Open this page in the source PDF</a></section>' +
      '</div>';
  }
  function openParcel(id) {
    var p = state.parcels.find(function (parcel) { return parcel.id === id; });
    if (!p) return;
    state.selected = p;
    renderDrawer(p);
    $("#drawer-backdrop").classList.remove("hidden");
    $("#parcel-drawer").classList.add("open");
    $("#parcel-drawer").setAttribute("aria-hidden","false");
    document.body.style.overflow = "hidden";
    $("#close-drawer").focus();
    loadParcelMedia(p.id);
    loadParcelNotes(p.id);
  }
  function closeDrawer() {
    $("#parcel-drawer").classList.remove("open");
    $("#parcel-drawer").setAttribute("aria-hidden","true");
    $("#drawer-backdrop").classList.add("hidden");
    document.body.style.overflow = "";
    state.selected = null;
  }
  function clearFilters() {
    state.search = ""; state.constituency = "all"; state.taluk = "all"; state.status = "all"; state.sort = "id";
    $("#search-input").value = ""; $("#constituency-filter").value = "all"; $("#taluk-filter").value = "all"; $("#status-filter").value = "all"; $("#sort-select").value = "id";
    renderRows();
  }
  function csvEscape(value) { return '"' + String(value == null ? "" : value).replace(/"/g,'""') + '"'; }
  function exportCsv() {
    var rows = filteredParcels();
    var headers = ['Register No.','Assembly constituency','Taluk','Hobli','Village','Survey No.','Acres','Guntas','Status tags'];
    var lines = [headers].concat(rows.map(function (p) {
      return [p.id,p.constituency,p.taluk,p.hobli,p.village,p.surveyNo,p.areaAcres,p.areaGuntas,(p.statusExtents||[]).map(function (s) { return s.label + ' (' + formatExtent(s.acres,s.guntas) + ')'; }).join('; ')];
    })).map(function (line) { return line.map(csvEscape).join(','); });
    var blob = new Blob(['\ufeff' + lines.join('\r\n')],{type:'text/csv;charset=utf-8;'});
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob); link.download = 'land-parcels-visible-rows.csv'; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(link.href);
    showToast(rows.length + ' parcel rows exported');
  }
  function bindEvents() {
    $$(".nav-item").forEach(function (button) { button.addEventListener("click",function () { setPage(button.getAttribute("data-page")); }); });
    $("#open-register").addEventListener("click",function () { setPage("parcels"); });
    $("#see-all").addEventListener("click",function () { setPage("parcels"); });
    $("#search-input").addEventListener("input",function (event) { state.search = event.target.value; renderRows(); });
    $("#constituency-filter").addEventListener("change",function (event) { state.constituency = event.target.value; renderRows(); });
    $("#taluk-filter").addEventListener("change",function (event) { state.taluk = event.target.value; renderRows(); });
    $("#status-filter").addEventListener("change",function (event) { state.status = event.target.value; renderRows(); });
    $("#sort-select").addEventListener("change",function (event) { state.sort = event.target.value; renderRows(); });
    $("#clear-filters").addEventListener("click",clearFilters);
    $("#reset-empty").addEventListener("click",clearFilters);
    $("#export-csv").addEventListener("click",exportCsv);
    $("#close-drawer").addEventListener("click",closeDrawer);
    $("#drawer-backdrop").addEventListener("click",closeDrawer);
    document.addEventListener("keydown",function (event) {
      if (event.key === "Escape" && $("#parcel-drawer").classList.contains("open")) closeDrawer();
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "k") { event.preventDefault(); setPage("parcels"); $("#search-input").focus(); }
    });
  }
  function init() {
    bindEvents();
    fetch("./data/parcels.json").then(function (response) { if (!response.ok) throw new Error("Could not load parcel data"); return response.json(); }).then(function (data) {
      state.data = data; state.parcels = data.parcels; fillFilters(); renderSummary(); renderRows();
      var requestedParcel = Number(new URLSearchParams(window.location.search).get("parcel"));
      if (Number.isInteger(requestedParcel) && state.parcels.some(function (parcel) { return parcel.id === requestedParcel; })) {
        setPage("parcels");
        openParcel(requestedParcel);
      }
    }).catch(function () {
      $("#parcel-count").textContent = "Unavailable";
      $("#result-count").textContent = "Parcel data could not be loaded";
      showToast("Refresh the page to load the PDF-derived parcel register");
    });
  }
  init();
})();
