/* Supabase-backed public gallery and approved-editor uploads. */
(function (root) {
  'use strict';
  var STORAGE_KEY = 'land-parcel-media-session-v1';
  var MAX_BYTES = 90 * 1024 * 1024;
  var PART_BYTES = 6 * 1024 * 1024;
  var TYPES = {
    jpg: ['image', 'image/jpeg'], jpeg: ['image', 'image/jpeg'],
    png: ['image', 'image/png'], webp: ['image', 'image/webp'],
    mp4: ['video', 'video/mp4'], webm: ['video', 'video/webm']
  };
  function cfg() { return root.LAND_PARCEL_MEDIA_CONFIG || {}; }
  function ready() {
    var c = cfg();
    return /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(c.url || '') &&
      typeof c.anonKey === 'string' && c.anonKey.length > 20 &&
      c.bucket === 'land-parcel-media';
  }
  function api(path) { return cfg().url.replace(/\/$/, '') + path; }
  function readSession() {
    try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null'); }
    catch (_) { return null; }
  }
  function saveSession(value) { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value)); }
  function clearSession() { sessionStorage.removeItem(STORAGE_KEY); }
  function headers(token) {
    var key = cfg().anonKey;
    var bearer = token || (/^sb_publishable_/.test(key) ? '' : key);
    var result = { apikey: key };
    if (bearer) result.Authorization = 'Bearer ' + bearer;
    return result;
  }
  async function responseJson(response) {
    var body = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(body.message || body.msg || body.error_description || body.error || ('Supabase returned ' + response.status));
    return body;
  }
  async function token() {
    var s = readSession();
    if (!s || !s.access_token) throw new Error('Sign in as an approved media editor to continue.');
    if (Number(s.expires_at) < Date.now() + 60000) {
      var refreshed = await responseJson(await fetch(api('/auth/v1/token?grant_type=refresh_token'), {
        method: 'POST', headers: { apikey: cfg().anonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: s.refresh_token })
      }));
      s = { access_token: refreshed.access_token, refresh_token: refreshed.refresh_token,
        expires_at: Date.now() + Number(refreshed.expires_in || 3600) * 1000,
        user: refreshed.user || s.user };
      saveSession(s);
    }
    return s.access_token;
  }
  async function request(path, options) {
    options = options || {};
    var access = options.auth ? await token() : null;
    var response = await fetch(api(path), {
      method: options.method || 'GET',
      headers: Object.assign({}, headers(access), options.headers || {}),
      body: options.body
    });
    if (response.status === 204) return null;
    return responseJson(response);
  }
  async function isApproved(s) {
    if (!s || !s.user || !s.user.email) return false;
    var rows = await request('/rest/v1/official_media_uploaders?select=email,active&email=eq.' +
      encodeURIComponent(String(s.user.email).toLowerCase()), { auth: true });
    return Array.isArray(rows) && rows.some(function (row) { return row.active === true; });
  }
  async function getAccess() {
    var s = readSession();
    var result = { ready: ready(), signedIn: Boolean(s && s.access_token), isAdmin: false,
      signInUrl: '/media-admin.html' };
    if (result.ready && result.signedIn) {
      try { result.isAdmin = await isApproved(s); }
      catch (_) { result.isAdmin = false; }
    }
    return result;
  }
  async function signIn(email, password) {
    if (!ready()) throw new Error('Online media storage is not configured yet.');
    var value = await responseJson(await fetch(api('/auth/v1/token?grant_type=password'), {
      method: 'POST', headers: { apikey: cfg().anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password: password })
    }));
    var s = { access_token: value.access_token, refresh_token: value.refresh_token,
      expires_at: Date.now() + Number(value.expires_in || 3600) * 1000, user: value.user };
    saveSession(s);
    if (!(await isApproved(s))) { clearSession(); throw new Error('This account is not on the approved media-uploader list.'); }
    return s;
  }
  async function sendPasswordReset(email) {
    if (!ready()) throw new Error('Online media storage is not configured yet.');
    var redirectTo = location.origin + '/media-admin.html';
    var response = await fetch(api('/auth/v1/recover?redirect_to=' + encodeURIComponent(redirectTo)), {
      method: 'POST', headers: { apikey: cfg().anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() })
    });
    if (!response.ok) throw new Error('Could not send a password-reset email.');
  }
  async function consumeAuthCallback() {
    var params = new URLSearchParams(location.hash.replace(/^#/, ''));
    var error = params.get('error_description') || params.get('error');
    if (error) throw new Error(decodeURIComponent(error.replace(/\+/g, ' ')));
    var access = params.get('access_token'), type = params.get('type');
    if (!access || !['invite', 'recovery', 'signup', 'magiclink'].includes(type)) return null;
    var user = await responseJson(await fetch(api('/auth/v1/user'), { headers: headers(access) }));
    var s = { access_token: access, refresh_token: params.get('refresh_token') || '',
      expires_at: Date.now() + Number(params.get('expires_in') || 3600) * 1000, user: user };
    saveSession(s); history.replaceState(null, '', location.pathname + location.search);
    return { type: type, session: s };
  }
  async function setPassword(password) {
    var access = await token();
    var user = await responseJson(await fetch(api('/auth/v1/user'), {
      method: 'PUT', headers: Object.assign({}, headers(access), { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ password: password })
    }));
    var s = readSession(); if (user && user.id) s.user = user; saveSession(s);
    return s;
  }
  function publicUrl(path) {
    return api('/storage/v1/object/public/' + encodeURIComponent(cfg().bucket) + '/' +
      String(path).split('/').map(encodeURIComponent).join('/'));
  }
  async function list(parcelId) {
    if (!ready()) return [];
    var rows = await request('/rest/v1/land_parcel_media?select=id,parcel_id,media_type,object_path,file_name,mime_type,size_bytes,created_at&parcel_id=eq.' +
      encodeURIComponent(parcelId) + '&order=created_at.desc');
    return (rows || []).map(function (row) { return {
      id: row.id, parcelId: Number(row.parcel_id), mediaType: row.media_type,
      fileName: row.file_name, mimeType: row.mime_type, sizeBytes: Number(row.size_bytes),
      uploadedAt: row.created_at, objectPath: row.object_path, url: publicUrl(row.object_path)
    }; });
  }
  function fileInfo(file) {
    var ext = String(file.name).split('.').pop().toLowerCase();
    var info = TYPES[ext];
    if (!info || (file.type && file.type !== info[1])) throw new Error(file.name + ': use JPG, PNG, WebP, MP4 or WebM.');
    if (!file.size || file.size > MAX_BYTES) throw new Error(file.name + ': file must be between 1 byte and 90 MB.');
    return { mediaType: info[0], mimeType: info[1], extension: ext };
  }
  function safeName(name) {
    var value = String(name || 'parcel-media').normalize('NFKC').replace(/[\\/\r\n\0]/g, '_').trim().slice(0, 180);
    return value || 'parcel-media';
  }
  async function removeObject(path, access) {
    var response = await fetch(api('/storage/v1/object/' + encodeURIComponent(cfg().bucket)), {
      method: 'DELETE', headers: Object.assign({}, headers(access), { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ prefixes: [path] })
    });
    if (!response.ok) throw new Error('Could not remove the stored media file.');
  }
  async function upload(parcelId, file, replaceId) {
    if (!Number.isInteger(Number(parcelId)) || Number(parcelId) < 1 || Number(parcelId) > 79) throw new Error('Choose a parcel from 1 to 79.');
    var fileData = fileInfo(file), access = await token();
    if (!(await isApproved(readSession()))) throw new Error('This account is not approved to manage media.');
    var old = null;
    if (replaceId) {
      var existing = await request('/rest/v1/land_parcel_media?select=id,parcel_id,media_type,object_path&id=eq.' + encodeURIComponent(replaceId), { auth: true });
      old = existing && existing[0];
      if (!old || Number(old.parcel_id) !== Number(parcelId) || old.media_type !== fileData.mediaType) throw new Error('Choose a file of the same type for this parcel.');
    }
    var folder = 'parcel-' + String(parcelId).padStart(3, '0');
    var objectPath = folder + '/' + crypto.randomUUID() + '.' + fileData.extension;
    var objectUrl = api('/storage/v1/object/' + encodeURIComponent(cfg().bucket) + '/' + objectPath.split('/').map(encodeURIComponent).join('/'));
    var put = await fetch(objectUrl, { method: 'POST', headers: Object.assign({}, headers(access), {
      'Content-Type': fileData.mimeType, 'x-upsert': 'false'
    }), body: file });
    if (!put.ok) {
      var problem = await put.json().catch(function () { return {}; });
      throw new Error(problem.message || ('File upload failed (' + put.status + ').'));
    }
    var record = { parcel_id: Number(parcelId), media_type: fileData.mediaType, object_path: objectPath,
      file_name: safeName(file.name), mime_type: fileData.mimeType, size_bytes: file.size };
    try {
      if (old) {
        await request('/rest/v1/land_parcel_media?id=eq.' + encodeURIComponent(replaceId), {
          auth: true, method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(record)
        });
      } else {
        record.uploader_id = readSession().user.id;
        await request('/rest/v1/land_parcel_media', {
          auth: true, method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(record)
        });
      }
    } catch (error) {
      await removeObject(objectPath, access).catch(function () {});
      throw error;
    }
    if (old) await removeObject(old.object_path, access);
    return { objectPath: objectPath, url: publicUrl(objectPath) };
  }
  async function remove(id) {
    var access = await token();
    var rows = await request('/rest/v1/land_parcel_media?select=id,object_path&id=eq.' + encodeURIComponent(id), { auth: true });
    var row = rows && rows[0];
    if (!row) throw new Error('Media item not found.');
    await removeObject(row.object_path, access);
    await request('/rest/v1/land_parcel_media?id=eq.' + encodeURIComponent(id), { auth: true, method: 'DELETE' });
  }
  root.LandParcelMedia = {
    ready: ready, getAccess: getAccess, signIn: signIn, sendPasswordReset: sendPasswordReset,
    consumeAuthCallback: consumeAuthCallback, setPassword: setPassword,
    clearSession: clearSession, list: list, upload: upload, remove: remove,
    fileInfo: fileInfo, maxBytes: MAX_BYTES
  };
})(window);
