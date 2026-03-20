(function () {
	var supabase = null;
	if (typeof window.supabase !== 'undefined' && window.SUPABASE_URL) {
		supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
	}

	var overlay = document.getElementById('profileModalOverlay');
	var btnEdit = document.querySelector('[data-profile-edit]');
	var btnSave = document.getElementById('profileModalSave');
	var btnAddPhoto = document.getElementById('profileModalAddPhoto');
	var btnClose = document.getElementById('profileModalClose');
	var fileInput = document.getElementById('modalAvatarFile');

	var workOverlay = document.getElementById('workModalOverlay');
	var btnWorkEdit = document.querySelector('[data-work-edit]');
	var btnWorkSave = document.getElementById('workModalSave');
	var btnWorkClose = document.getElementById('workModalClose');

	var ticketsOverlay = document.getElementById('ticketsModalOverlay');
	var btnTicketsOpen = document.querySelector('[data-tickets-open]');
	var btnTicketsClose = document.getElementById('ticketsModalClose');

	var ticketDetailOverlay = document.getElementById('ticketDetailModalOverlay');
	var btnTicketDetailClose = document.getElementById('ticketDetailModalClose');
	var btnTicketDetailDelete = document.getElementById('ticketDetailDelete');
	var logoutConfirmOverlay = document.getElementById('logoutConfirmOverlay');
	var btnLogoutConfirmNo = document.getElementById('logoutConfirmNo');
	var btnLogoutConfirmYes = document.getElementById('logoutConfirmYes');
	var btnLogoutConfirmClose = document.getElementById('logoutConfirmClose');
	var changePhotoModalOverlay = document.getElementById('changePhotoModalOverlay');
	var btnChangePhotoClose = document.getElementById('changePhotoModalClose');
	var btnChangePhotoAddNew = document.getElementById('changePhotoAddNew');
	var btnChangePhotoRemove = document.getElementById('changePhotoRemove');
	var currentTicketId = null;

	var requestModalOverlay = document.getElementById('requestModalOverlay');
	var btnCreateRequest = document.querySelector('[data-create-request]');
	var btnRequestModalClose = document.getElementById('requestModalClose');
	var ticketDetailTitle = document.getElementById('ticketDetailModalTitle');
	var ticketDetailDesc = document.getElementById('ticketDetailDesc');
	var ticketDetailDate = document.getElementById('ticketDetailDate');
	var ticketDetailStatus = document.getElementById('ticketDetailStatus');

	var cardName = document.getElementById('cardName');
	var cardEmail = document.getElementById('cardEmail');
	var cardPhone = document.getElementById('cardPhone');
	var cardAvatarWrap = document.getElementById('cardAvatarWrap');
	var cardAvatarImg = document.getElementById('cardAvatarImg');

	var cardWorkCompany = document.getElementById('cardWorkCompany');
	var cardWorkPosition = document.getElementById('cardWorkPosition');
	var cardWorkDepartment = document.getElementById('cardWorkDepartment');

	var profileNavUserName = document.getElementById('profileNavUserName');

	var modalName = document.getElementById('modalName');
	var modalEmail = document.getElementById('modalEmail');
	var modalPhone = document.getElementById('modalPhone');
	var modalAvatarImg = document.getElementById('modalAvatarImg');
	var modalAvatarPreview = document.getElementById('modalAvatarPreview');

	var modalWorkCompany = document.getElementById('modalWorkCompany');
	var modalWorkPosition = document.getElementById('modalWorkPosition');
	var modalWorkDepartment = document.getElementById('modalWorkDepartment');

	// Храним data URL выбранного фото (для переноса в карточку при сохранении)
	var currentAvatarDataUrl = '';

	function statusToLabel(s) {
		if (s == null || s === '') return 'Новая';
		var t = String(s).trim();
		var x = t.toLowerCase().replace(/\s+/g, '_');
		if (x === 'new') return 'Новая';
		if (x === 'done' || t === 'Решено') return 'Завершено';
		if (x === 'in_progress') return 'В работе';
		if (t.toLowerCase().replace(/\s+/g, ' ') === 'in progress') return 'В работе';
		return 'В обработке';
	}

	function formatDate(iso) {
		if (!iso) return '—';
		var d = new Date(iso);
		var day = ('0' + d.getDate()).slice(-2);
		var month = ('0' + (d.getMonth() + 1)).slice(-2);
		var year = d.getFullYear();
		var h = ('0' + d.getHours()).slice(-2);
		var m = ('0' + d.getMinutes()).slice(-2);
		return day + '.' + month + '.' + year + ', ' + h + ':' + m;
	}

	function renderApplications(list) {
		var cardList = document.getElementById('profileTicketList');
		var modalList = document.getElementById('ticketsModalList');
		var totalEl = document.getElementById('summaryTotal');
		var activeEl = document.getElementById('summaryActive');
		var solvedEl = document.getElementById('summarySolved');
		var unfinishedEl = document.getElementById('summaryUnfinished');
		var solved = (list || []).filter(function (a) { return (a.status || '').toLowerCase() === 'done' || a.status === 'Решено'; }).length;
		var total = (list || []).length;
		var active = total - solved;
		if (totalEl) totalEl.textContent = total;
		if (activeEl) activeEl.textContent = active;
		if (solvedEl) solvedEl.textContent = solved;
		if (unfinishedEl) unfinishedEl.textContent = '0';
		var html = (list || []).map(function (a, i) {
			var num = '№' + (a.id || '').toString().slice(-4);
			var desc = (a.comment || a.service || 'Заявка').slice(0, 80);
			if ((a.comment || a.service || '').length > 80) desc += '…';
			var dateStr = formatDate(a.created_at);
			var statusLabel = statusToLabel(a.status);
			return '<li class="profile-ticket-item" data-ticket-id="' + (a.id || '') + '">' +
				'<div class="profile-ticket-main">' +
				'<button type="button" class="profile-ticket-num profile-ticket-num-btn">' + num + '</button>' +
				'<p class="profile-ticket-desc">' + (desc.replace(/</g, '&lt;')) + '</p>' +
				'<span class="profile-ticket-date">Создано: ' + dateStr + '</span>' +
				'</div>' +
				'<div class="profile-ticket-tags"><span class="profile-tag profile-tag-status">' + statusLabel + '</span></div>' +
				'</li>';
		}).join('');
		if (!html) html = '<li class="profile-ticket-item"><p class="profile-ticket-desc">Заявок пока нет</p></li>';
		if (cardList) cardList.innerHTML = html;
		if (modalList) modalList.innerHTML = html;
	}

	function loadProfileAndTickets() {
		if (!supabase) return;
		function tryLoad(retry) {
			supabase.auth.getSession().then(function (res) {
				var session = res.data && res.data.session;
				var user = session && session.user;
				if (!user) {
					if (retry) {
						setTimeout(function () { tryLoad(false); }, 300);
						return;
					}
					window.location.href = 'login.html';
					return;
				}
				var uid = user.id;
			supabase.from('profiles').select('*').eq('id', uid).maybeSingle().then(function (r) {
				var row = r.data;
				if (row) {
					if (cardName) cardName.value = row.name || '';
					if (cardEmail) cardEmail.value = row.email || '';
					if (cardPhone) cardPhone.value = row.phone || '';
					if (profileNavUserName) profileNavUserName.textContent = row.name || row.email || 'Профиль';
					if (cardWorkCompany) cardWorkCompany.value = row.company || 'Не заполнено';
					if (cardWorkPosition) cardWorkPosition.value = row.position || 'Не заполнено';
					if (cardWorkDepartment) cardWorkDepartment.value = row.department || 'Не заполнено';
					if (modalName) modalName.value = row.name || '';
					if (modalEmail) modalEmail.value = row.email || '';
					if (modalPhone) modalPhone.value = row.phone || '';
					if (modalWorkCompany) modalWorkCompany.value = row.company || '';
					if (modalWorkPosition) modalWorkPosition.value = row.position || '';
					if (modalWorkDepartment) modalWorkDepartment.value = row.department || '';
					if (row.avatar_url && cardAvatarImg) {
						cardAvatarImg.src = row.avatar_url;
						cardAvatarImg.style.display = 'block';
						var cardFb = cardAvatarWrap && cardAvatarWrap.querySelector('.profile-avatar-icon-fallback');
						if (cardFb) cardFb.style.display = 'none';
					} else if (cardAvatarImg) {
						cardAvatarImg.removeAttribute('src');
						cardAvatarImg.style.display = 'none';
					}
				} else {
					if (profileNavUserName) profileNavUserName.textContent = user.email || 'Профиль';
				}
			});
			supabase.from('applications').select('*').order('created_at', { ascending: false }).then(function (r) {
				renderApplications(r.data || []);
			});
		});
		}
		tryLoad(true);
	}

	function bodyOverflowRestore() {
		var profileOpen = overlay.classList.contains('is-open');
		var workOpen = workOverlay && workOverlay.classList.contains('is-open');
		var ticketsOpen = ticketsOverlay && ticketsOverlay.classList.contains('is-open');
		var detailOpen = ticketDetailOverlay && ticketDetailOverlay.classList.contains('is-open');
		var requestOpen = requestModalOverlay && requestModalOverlay.classList.contains('is-open');
		var logoutOpen = logoutConfirmOverlay && logoutConfirmOverlay.classList.contains('is-open');
		var changePhotoOpen = changePhotoModalOverlay && changePhotoModalOverlay.classList.contains('is-open');
		if (!profileOpen && !workOpen && !ticketsOpen && !detailOpen && !requestOpen && !logoutOpen && !changePhotoOpen) document.body.style.overflow = '';
	}

	function openModal() {
		// Синхронизируем текущие значения из карточки в модалку
		modalName.value = cardName.value;
		modalEmail.value = cardEmail.value;
		modalPhone.value = cardPhone.value;
		if (cardAvatarImg && cardAvatarImg.src && cardAvatarImg.getAttribute('src')) {
			modalAvatarImg.src = cardAvatarImg.src;
			modalAvatarImg.style.display = 'block';
			var fb = modalAvatarPreview.querySelector('.profile-avatar-icon-fallback');
			if (fb) fb.style.display = 'none';
		} else {
			modalAvatarImg.removeAttribute('src');
			modalAvatarImg.style.display = 'none';
			var fb = modalAvatarPreview.querySelector('.profile-avatar-icon-fallback');
			if (fb) fb.style.display = '';
		}
		currentAvatarDataUrl = (cardAvatarImg && cardAvatarImg.src) ? cardAvatarImg.src : '';
		if (btnAddPhoto) btnAddPhoto.textContent = currentAvatarDataUrl ? 'Изменить фото' : 'Добавить фото профиля';
		overlay.classList.add('is-open');
		overlay.setAttribute('aria-hidden', 'false');
		document.body.style.overflow = 'hidden';
		modalName.focus();
	}

	function closeModal() {
		overlay.classList.remove('is-open');
		overlay.setAttribute('aria-hidden', 'true');
		bodyOverflowRestore();
	}

	function openWorkModal() {
		if (modalWorkCompany) modalWorkCompany.value = cardWorkCompany.value;
		if (modalWorkPosition) modalWorkPosition.value = cardWorkPosition.value;
		if (modalWorkDepartment) modalWorkDepartment.value = cardWorkDepartment.value;
		workOverlay.classList.add('is-open');
		workOverlay.setAttribute('aria-hidden', 'false');
		document.body.style.overflow = 'hidden';
		if (modalWorkCompany) modalWorkCompany.focus();
	}

	function closeWorkModal() {
		workOverlay.classList.remove('is-open');
		workOverlay.setAttribute('aria-hidden', 'true');
		bodyOverflowRestore();
	}

	function saveWorkAndClose() {
		var company = modalWorkCompany.value.trim();
		var position = modalWorkPosition.value.trim();
		var department = modalWorkDepartment.value.trim() || 'Не заполнено';
		cardWorkCompany.value = company;
		cardWorkPosition.value = position;
		cardWorkDepartment.value = department;
		closeWorkModal();
		if (supabase) {
			supabase.auth.getUser().then(function (res) {
				var uid = res.data && res.data.user && res.data.user.id;
				if (uid) supabase.from('profiles').update({ company: company, position: position, department: department }).eq('id', uid).then(function () {});
			});
		}
	}

	function openTicketsModal() {
		ticketsOverlay.classList.add('is-open');
		ticketsOverlay.setAttribute('aria-hidden', 'false');
		document.body.style.overflow = 'hidden';
	}

	function closeTicketsModal() {
		ticketsOverlay.classList.remove('is-open');
		ticketsOverlay.setAttribute('aria-hidden', 'true');
		if (ticketDetailOverlay && ticketDetailOverlay.classList.contains('is-open')) closeTicketDetailModal();
		bodyOverflowRestore();
	}

	function openTicketDetailModal(ticketItem) {
		currentTicketId = ticketItem.getAttribute('data-ticket-id') || null;
		var numEl = ticketItem.querySelector('.profile-ticket-num-btn, .profile-ticket-num');
		var descEl = ticketItem.querySelector('.profile-ticket-desc');
		var dateEl = ticketItem.querySelector('.profile-ticket-date');
		var statusEl = ticketItem.querySelector('.profile-ticket-tags .profile-tag-status');
		var num = numEl ? numEl.textContent.trim() : '—';
		var desc = descEl ? descEl.textContent.trim() : '—';
		var date = dateEl ? dateEl.textContent.replace(/^Создано:\s*/i, '').trim() : '—';
		var status = statusEl ? statusEl.textContent.trim() : '—';
		if (ticketDetailTitle) ticketDetailTitle.textContent = 'Заявка ' + num;
		if (ticketDetailDesc) ticketDetailDesc.textContent = desc;
		if (ticketDetailDate) ticketDetailDate.textContent = date;
		if (ticketDetailStatus) ticketDetailStatus.textContent = status;
		if (btnTicketDetailDelete) btnTicketDetailDelete.style.display = currentTicketId ? '' : 'none';
		ticketDetailOverlay.classList.add('is-open');
		ticketDetailOverlay.setAttribute('aria-hidden', 'false');
		document.body.style.overflow = 'hidden';
	}

	function closeTicketDetailModal() {
		ticketDetailOverlay.classList.remove('is-open');
		ticketDetailOverlay.setAttribute('aria-hidden', 'true');
		bodyOverflowRestore();
	}

	function openRequestModal() {
		requestModalOverlay.classList.add('is-open');
		requestModalOverlay.setAttribute('aria-hidden', 'false');
		document.body.style.overflow = 'hidden';
	}

	function closeRequestModal() {
		requestModalOverlay.classList.remove('is-open');
		requestModalOverlay.setAttribute('aria-hidden', 'true');
		bodyOverflowRestore();
	}

	function saveAndClose() {
		var name = modalName.value.trim();
		var email = modalEmail.value.trim();
		var phone = modalPhone.value.trim();
		cardName.value = name;
		cardEmail.value = email;
		cardPhone.value = phone;
		if (profileNavUserName) profileNavUserName.textContent = name;
		if (currentAvatarDataUrl && cardAvatarImg) {
			cardAvatarImg.src = currentAvatarDataUrl;
			cardAvatarImg.style.display = 'block';
			var cardFallback = cardAvatarWrap && cardAvatarWrap.querySelector('.profile-avatar-icon-fallback');
			if (cardFallback) cardFallback.style.display = 'none';
		}
		closeModal();
		if (supabase) {
			supabase.auth.getUser().then(function (res) {
				var uid = res.data && res.data.user && res.data.user.id;
				if (!uid) return;
				var payload = { id: uid, email: email, name: name, phone: phone };
				if (currentAvatarDataUrl && typeof currentAvatarDataUrl === 'string') {
					payload.avatar_url = currentAvatarDataUrl;
				} else {
					payload.avatar_url = null;
				}
				supabase.from('profiles').upsert(payload, { onConflict: 'id' }).then(function (result) {
					if (result.error) console.error('Profile save error:', result.error);
				});
			});
		}
	}

	function compressAvatar(dataUrl, maxSize, quality) {
		maxSize = maxSize || 256;
		quality = quality == null ? 0.82 : quality;
		return new Promise(function (resolve) {
			var img = new Image();
			img.onload = function () {
				var w = img.naturalWidth;
				var h = img.naturalHeight;
				if (w <= maxSize && h <= maxSize) {
					var c = document.createElement('canvas');
					c.width = w;
					c.height = h;
					c.getContext('2d').drawImage(img, 0, 0);
					resolve(c.toDataURL('image/jpeg', quality));
					return;
				}
				var scale = maxSize / Math.max(w, h);
				var c = document.createElement('canvas');
				c.width = Math.round(w * scale);
				c.height = Math.round(h * scale);
				c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
				resolve(c.toDataURL('image/jpeg', quality));
			};
			img.onerror = function () { resolve(dataUrl); };
			img.src = dataUrl;
		});
	}

	function openChangePhotoModal() {
		if (changePhotoModalOverlay) {
			changePhotoModalOverlay.classList.add('is-open');
			changePhotoModalOverlay.setAttribute('aria-hidden', 'false');
			document.body.style.overflow = 'hidden';
		}
	}
	function closeChangePhotoModal() {
		if (changePhotoModalOverlay) {
			changePhotoModalOverlay.classList.remove('is-open');
			changePhotoModalOverlay.setAttribute('aria-hidden', 'true');
			bodyOverflowRestore();
		}
	}
	function onAddPhotoClick() {
		if (currentAvatarDataUrl) {
			openChangePhotoModal();
		} else if (fileInput) {
			fileInput.click();
		}
	}

	function onFileChange(e) {
		var file = e.target && e.target.files[0];
		if (!file || !file.type.startsWith('image/')) return;
		var reader = new FileReader();
		reader.onload = function () {
			var raw = reader.result;
			compressAvatar(raw, 256, 0.82).then(function (compressed) {
				currentAvatarDataUrl = compressed;
				modalAvatarImg.src = currentAvatarDataUrl;
				modalAvatarImg.style.display = 'block';
				var fallback = modalAvatarPreview.querySelector('.profile-avatar-icon-fallback');
				if (fallback) fallback.style.display = 'none';
				if (btnAddPhoto) btnAddPhoto.textContent = 'Изменить фото';
			});
			e.target.value = '';
		};
		reader.readAsDataURL(file);
		e.target.value = '';
	}

	function openLogoutConfirmModal() {
		if (logoutConfirmOverlay) {
			logoutConfirmOverlay.classList.add('is-open');
			logoutConfirmOverlay.setAttribute('aria-hidden', 'false');
			document.body.style.overflow = 'hidden';
		}
	}
	function closeLogoutConfirmModal() {
		if (logoutConfirmOverlay) {
			logoutConfirmOverlay.classList.remove('is-open');
			logoutConfirmOverlay.setAttribute('aria-hidden', 'true');
			bodyOverflowRestore();
		}
	}
	function doLogout() {
		closeLogoutConfirmModal();
		if (supabase) supabase.auth.signOut().then(function () { window.location.href = 'index.html'; });
	}

	function onOverlayClick(e) {
		if (e.target === overlay) closeModal();
		if (workOverlay && e.target === workOverlay) closeWorkModal();
		if (ticketsOverlay && e.target === ticketsOverlay) closeTicketsModal();
		if (ticketDetailOverlay && e.target === ticketDetailOverlay) closeTicketDetailModal();
		if (requestModalOverlay && e.target === requestModalOverlay) closeRequestModal();
		if (logoutConfirmOverlay && e.target === logoutConfirmOverlay) closeLogoutConfirmModal();
		if (changePhotoModalOverlay && e.target === changePhotoModalOverlay) closeChangePhotoModal();
	}

	function onKeyDown(e) {
		if (e.key !== 'Escape') return;
		if (logoutConfirmOverlay && logoutConfirmOverlay.classList.contains('is-open')) closeLogoutConfirmModal();
		else if (changePhotoModalOverlay && changePhotoModalOverlay.classList.contains('is-open')) closeChangePhotoModal();
		else if (requestModalOverlay && requestModalOverlay.classList.contains('is-open')) closeRequestModal();
		else if (ticketDetailOverlay && ticketDetailOverlay.classList.contains('is-open')) closeTicketDetailModal();
		else if (overlay.classList.contains('is-open')) closeModal();
		else if (workOverlay && workOverlay.classList.contains('is-open')) closeWorkModal();
		else if (ticketsOverlay && ticketsOverlay.classList.contains('is-open')) closeTicketsModal();
	}

	if (btnEdit) btnEdit.addEventListener('click', openModal);
	if (btnSave) btnSave.addEventListener('click', saveAndClose);
	if (btnClose) btnClose.addEventListener('click', closeModal);
	if (btnAddPhoto) btnAddPhoto.addEventListener('click', onAddPhotoClick);
	if (fileInput) fileInput.addEventListener('change', onFileChange);
	if (overlay) overlay.addEventListener('click', onOverlayClick);
	if (changePhotoModalOverlay) changePhotoModalOverlay.addEventListener('click', onOverlayClick);
	if (btnChangePhotoClose) btnChangePhotoClose.addEventListener('click', closeChangePhotoModal);
	if (btnChangePhotoAddNew) btnChangePhotoAddNew.addEventListener('click', function () {
		closeChangePhotoModal();
		if (fileInput) fileInput.click();
	});
	if (btnChangePhotoRemove) btnChangePhotoRemove.addEventListener('click', function () {
		currentAvatarDataUrl = '';
		if (modalAvatarImg) {
			modalAvatarImg.removeAttribute('src');
			modalAvatarImg.style.display = 'none';
		}
		var fallback = modalAvatarPreview && modalAvatarPreview.querySelector('.profile-avatar-icon-fallback');
		if (fallback) fallback.style.display = '';
		if (btnAddPhoto) btnAddPhoto.textContent = 'Добавить фото профиля';
		closeChangePhotoModal();
	});

	if (btnWorkEdit) btnWorkEdit.addEventListener('click', openWorkModal);
	if (btnWorkSave) btnWorkSave.addEventListener('click', saveWorkAndClose);
	if (btnWorkClose) btnWorkClose.addEventListener('click', closeWorkModal);
	if (workOverlay) workOverlay.addEventListener('click', onOverlayClick);

	if (btnTicketsOpen) btnTicketsOpen.addEventListener('click', openTicketsModal);
	if (btnTicketsClose) btnTicketsClose.addEventListener('click', closeTicketsModal);
	if (ticketsOverlay) ticketsOverlay.addEventListener('click', onOverlayClick);

	if (btnTicketDetailClose) btnTicketDetailClose.addEventListener('click', closeTicketDetailModal);
	if (btnTicketDetailDelete) btnTicketDetailDelete.addEventListener('click', function () {
		if (!currentTicketId || !supabase) return;
		supabase.from('applications').delete().eq('id', currentTicketId).then(function (r) {
			if (r.error) {
				console.error(r.error);
				alert('Не удалось удалить заявку.');
				return;
			}
			closeTicketDetailModal();
			supabase.from('applications').select('*').order('created_at', { ascending: false }).then(function (rr) {
				renderApplications(rr.data || []);
			});
		});
	});
	if (ticketDetailOverlay) ticketDetailOverlay.addEventListener('click', onOverlayClick);

	if (logoutConfirmOverlay) logoutConfirmOverlay.addEventListener('click', onOverlayClick);
	if (btnLogoutConfirmNo) btnLogoutConfirmNo.addEventListener('click', closeLogoutConfirmModal);
	if (btnLogoutConfirmYes) btnLogoutConfirmYes.addEventListener('click', doLogout);
	if (btnLogoutConfirmClose) btnLogoutConfirmClose.addEventListener('click', closeLogoutConfirmModal);

	if (btnCreateRequest) btnCreateRequest.addEventListener('click', openRequestModal);
	if (btnRequestModalClose) btnRequestModalClose.addEventListener('click', closeRequestModal);
	if (requestModalOverlay) requestModalOverlay.addEventListener('click', onOverlayClick);

	var requestForm = document.querySelector('.form-request-modal');
	if (requestForm) requestForm.addEventListener('submit', function (e) {
		e.preventDefault();
		var nameEl = document.getElementById('modal-request-name');
		var emailEl = document.getElementById('modal-request-email');
		var phoneEl = document.getElementById('modal-request-phone');
		var companyEl = document.getElementById('modal-request-company');
		var workplacesEl = document.getElementById('modal-request-workplaces');
		var serviceEl = document.getElementById('modal-request-service');
		var commentEl = document.getElementById('modal-request-comment');
		var name = nameEl && nameEl.value ? nameEl.value.trim() : '';
		var email = emailEl && emailEl.value ? emailEl.value.trim() : '';
		var phone = phoneEl && phoneEl.value ? phoneEl.value.trim() : '';
		var company = companyEl && companyEl.value ? companyEl.value.trim() : '';
		var workplaces = workplacesEl && workplacesEl.value ? workplacesEl.value.trim() : '';
		var service = serviceEl && serviceEl.value ? serviceEl.value.trim() : '';
		var comment = commentEl && commentEl.value ? commentEl.value.trim() : '';
		if (!supabase) { closeRequestModal(); return; }
		supabase.auth.getUser().then(function (res) {
			var uid = res.data && res.data.user && res.data.user.id;
			if (!uid) { closeRequestModal(); return; }
			supabase.from('applications').insert({
				user_id: uid,
				name: name,
				email: email,
				phone: phone,
				company: company,
				workplaces: workplaces,
				service: service,
				comment: comment,
				status: 'new'
			}).then(function (r) {
				if (r.error) console.error(r.error);
				supabase.from('applications').select('*').order('created_at', { ascending: false }).then(function (rr) {
					renderApplications(rr.data || []);
				});
				closeRequestModal();
				requestForm.reset();
			});
		});
	});

	// Клик по номеру заявки: на карточке «Мои заявки» и в модалке «Все заявки»
	function onTicketNumClick(e) {
		var btn = e.target.closest('.profile-ticket-num-btn');
		if (!btn) return;
		var item = btn.closest('.profile-ticket-item');
		if (item) openTicketDetailModal(item);
	}
	var cardTicketsList = document.querySelector('.profile-card-tickets .profile-ticket-list');
	if (cardTicketsList) cardTicketsList.addEventListener('click', onTicketNumClick);
	var ticketsBody = document.querySelector('#ticketsModalOverlay .profile-modal-tickets-body');
	if (ticketsBody) ticketsBody.addEventListener('click', onTicketNumClick);

	var btnLogout = document.querySelector('[data-logout]');
	if (btnLogout) {
		btnLogout.addEventListener('click', openLogoutConfirmModal);
	}

	loadProfileAndTickets();
	document.addEventListener('keydown', onKeyDown);
})();
