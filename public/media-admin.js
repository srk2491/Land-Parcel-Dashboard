'use strict';
var $ = function (id) { return document.getElementById(id); };
var selectedParcel = null;
var parcels = [];
function setStatus(id, message, error) {
  var el = $(id); el.textContent = message || ''; el.classList.toggle('error', Boolean(error));
}
function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
  });
}
function bytes(value) { return (Number(value) / (1024 * 1024)).toFixed(1) + ' MB'; }
function selectedId() { return Number($('parcel-select').value); }
function returnUrl(id) { return './index.html?parcel=' + encodeURIComponent(id); }
async function loadParcels() {
  var response = await fetch('./data/parcels.json');
  if (!response.ok) throw new Error('Could not load parcel register.');
  var data = await response.json(); parcels = data.parcels || [];
  var preferred = Number(new URLSearchParams(location.search).get('parcel'));
  $('parcel-select').innerHTML = parcels.map(function (p) {
    return '<option value="' + p.id + '">' + String(p.id).padStart(3, '0') + ' · ' + escapeHtml(p.village) + ' · Survey ' + escapeHtml(p.surveyNo) + '</option>';
  }).join('');
  if (parcels.some(function (p) { return p.id === preferred; })) $('parcel-select').value = String(preferred);
  updateReturnLink();
}
function updateReturnLink() { $('return-link').href = returnUrl(selectedId() || 1); }
async function renderGallery() {
  var id = selectedId(); updateReturnLink();
  $('gallery').replaceChildren();
  if (!id) return;
  try {
    var items = await LandParcelMedia.list(id);
    $('item-count').textContent = items.length + (items.length === 1 ? ' item' : ' items');
    if (!items.length) {
      var empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = 'No photos or videos have been uploaded for this parcel yet.'; $('gallery').append(empty); return;
    }
    items.forEach(function (item) {
      var card = document.createElement('article'); card.className = 'media-card';
      var preview = document.createElement(item.mediaType === 'video' ? 'video' : 'img');
      preview.className = 'media-preview'; preview.src = item.url;
      if (item.mediaType === 'video') { preview.controls = true; preview.preload = 'metadata'; }
      else { preview.alt = item.fileName; preview.loading = 'lazy'; }
      var info = document.createElement('div'); info.className = 'media-info';
      info.innerHTML = '<strong>' + escapeHtml(item.fileName) + '</strong><span>' + (item.mediaType === 'video' ? 'Video' : 'Photo') + ' · ' + bytes(item.sizeBytes) + '</span>';
      var actions = document.createElement('div'); actions.className = 'media-actions';
      var replaceLabel = document.createElement('label'); replaceLabel.textContent = 'Replace';
      var replacement = document.createElement('input'); replacement.type = 'file';
      replacement.accept = item.mediaType === 'video' ? 'video/mp4,video/webm' : 'image/jpeg,image/png,image/webp';
      replaceLabel.append(replacement);
      var replaceButton = document.createElement('button'); replaceButton.type = 'button'; replaceButton.textContent = 'Save replacement';
      replaceButton.addEventListener('click', async function () {
        if (!replacement.files || !replacement.files[0]) { setStatus('manager-status', 'Choose a replacement file first.', true); return; }
        replaceButton.disabled = true; setStatus('manager-status', 'Uploading replacement…');
        try { await LandParcelMedia.upload(id, replacement.files[0], item.id); setStatus('manager-status', 'Replacement saved.'); await renderGallery(); }
        catch (error) { setStatus('manager-status', error.message, true); }
        finally { replaceButton.disabled = false; }
      });
      var deleteButton = document.createElement('button'); deleteButton.type = 'button'; deleteButton.className = 'danger'; deleteButton.textContent = 'Delete';
      deleteButton.addEventListener('click', async function () {
        if (!window.confirm('Delete this photo or video from the parcel?')) return;
        deleteButton.disabled = true;
        try { await LandParcelMedia.remove(item.id); setStatus('manager-status', 'Media deleted.'); await renderGallery(); }
        catch (error) { setStatus('manager-status', error.message, true); deleteButton.disabled = false; }
      });
      actions.append(replaceLabel, replaceButton, deleteButton); card.append(preview, info, actions); $('gallery').append(card);
    });
  } catch (error) { setStatus('manager-status', error.message, true); }
}
function showManager() {
  $('login-panel').hidden = true; $('manager-panel').hidden = false;
  var session = null; try { session = JSON.parse(sessionStorage.getItem('land-parcel-media-session-v1') || 'null'); } catch (_) {}
  $('signed-in-as').textContent = session && session.user ? 'Signed in as ' + session.user.email : '';
  renderGallery();
}
async function boot() {
  if (!LandParcelMedia.ready()) { $('login-panel').hidden = true; $('setup-note').hidden = false; return; }
  $('login-form').addEventListener('submit', async function (event) {
    event.preventDefault(); var button = $('login-button'); button.disabled = true;
    setStatus('login-status', 'Signing in…');
    try { await LandParcelMedia.signIn($('email').value, $('password').value); showManager(); setStatus('manager-status', 'Signed in. Choose a parcel to manage its media.'); }
    catch (error) { setStatus('login-status', error.message, true); }
    finally { button.disabled = false; }
  });
  $('forgot-password').addEventListener('click', async function () {
    if (!$('email').value.trim()) { setStatus('login-status', 'Enter your email address first.', true); $('email').focus(); return; }
    try { await LandParcelMedia.sendPasswordReset($('email').value); setStatus('login-status', 'If the email belongs to an account, a password reset link has been sent.'); }
    catch (error) { setStatus('login-status', error.message, true); }
  });
  $('sign-out').addEventListener('click', function () { LandParcelMedia.clearSession(); $('manager-panel').hidden = true; $('login-panel').hidden = false; setStatus('login-status', 'Signed out.'); });
  $('password-form').addEventListener('submit', async function (event) {
    event.preventDefault();
    var password = $('new-password').value;
    if (password.length < 8) { setStatus('password-status', 'Use at least 8 characters.', true); return; }
    if (password !== $('confirm-password').value) { setStatus('password-status', 'The passwords do not match.', true); return; }
    var button = $('save-password'); button.disabled = true;
    try {
      await LandParcelMedia.setPassword(password);
      $('password-panel').hidden = true;
      var access = await LandParcelMedia.getAccess();
      if (!access.isAdmin) throw new Error('This account is not on the approved media-uploader list.');
      await loadParcels(); showManager(); setStatus('manager-status', 'Account ready. Choose a parcel to manage its media.');
    } catch (error) { setStatus('password-status', error.message, true); }
    finally { button.disabled = false; }
  });
  $('parcel-select').addEventListener('change', renderGallery);
  $('upload-form').addEventListener('submit', async function (event) {
    event.preventDefault(); var files = Array.from($('file-input').files || []), id = selectedId();
    if (!files.length) { setStatus('manager-status', 'Choose at least one photo or video.', true); return; }
    var button = $('upload-button'); button.disabled = true;
    try {
      for (var i = 0; i < files.length; i += 1) {
        setStatus('manager-status', 'Uploading ' + (i + 1) + ' of ' + files.length + ': ' + files[i].name);
        await LandParcelMedia.upload(id, files[i], null);
      }
      $('file-input').value = ''; await renderGallery(); setStatus('manager-status', 'Upload complete. The media is now visible on the public dashboard.');
    } catch (error) { setStatus('manager-status', error.message, true); await renderGallery(); }
    finally { button.disabled = false; }
  });
  var callback = null;
  try { callback = await LandParcelMedia.consumeAuthCallback(); }
  catch (error) { setStatus('login-status', error.message, true); }
  if (callback) {
    $('login-panel').hidden = true; $('manager-panel').hidden = true; $('password-panel').hidden = false;
    $('password-title').textContent = callback.type === 'recovery' ? 'Reset your password' : 'Set your editor password';
    $('password-description').textContent = 'Choose a password for ' + callback.session.user.email + '.';
    return;
  }
  try {
    await loadParcels();
    var access = await LandParcelMedia.getAccess();
    if (access.isAdmin) showManager();
  } catch (error) { setStatus('login-status', error.message, true); }
}
boot().catch(function (error) { setStatus('login-status', error.message, true); });
