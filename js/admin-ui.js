/**
 * Админка: UI + Supabase (все заявки, смена статусов → видно в личном кабинете клиента).
 * Статусы в БД: new | in_progress | done
 */
(function () {
	var overlay = document.getElementById('adminDetailOverlay');
	var btnClose = document.getElementById('adminDetailClose');
	var btnCloseFooter = document.getElementById('adminDetailCloseFooter');
	var btnWriteClient = document.getElementById('adminWriteClientBtn');
	var titleEl = document.getElementById('adminDetailTitle');
	var bodyEl = document.getElementById('adminDetailBody');
	var tbody = document.getElementById('adminTicketsBody');
	var toastEl = document.getElementById('adminToast');
	var searchInput = document.getElementById('adminTicketsSearch');
	var filterSelect = document.getElementById('adminTicketsFilter');
	var btnRefresh = document.getElementById('adminTicketsRefresh');
	var btnExport = document.getElementById('adminTicketsExport');
	var tableWrap = document.getElementById('adminTableWrap');

	var LABELS = {
		company: 'Компания',
		contact: 'Контакт',
		email: 'Email',
		phone: 'Телефон',
		service: 'Услуга',
		status: 'Статус',
		comment: 'Комментарий',
		date: 'Создано'
	};

	var supabaseClient = null;
	var dbMode = false;
	var modalLinkedRow = null;
	var toastTimer = null;

	function showToast(msg) {
		if (!toastEl) return;
		toastEl.textContent = msg;
		toastEl.classList.add('is-visible');
		if (toastTimer) clearTimeout(toastTimer);
		toastTimer = setTimeout(function () {
			toastEl.classList.remove('is-visible');
		}, 3200);
	}

	function formatDate(iso) {
		if (!iso) return '—';
		var d = new Date(iso);
		if (isNaN(d.getTime())) return '—';
		var day = ('0' + d.getDate()).slice(-2);
		var month = ('0' + (d.getMonth() + 1)).slice(-2);
		var year = d.getFullYear();
		var h = ('0' + d.getHours()).slice(-2);
		var m = ('0' + d.getMinutes()).slice(-2);
		return day + '.' + month + '.' + year + ', ' + h + ':' + m;
	}

	/** DB status → data-admin-state */
	function dbToUiState(dbStatus) {
		var x = (dbStatus || '').toString().toLowerCase().replace(/\s+/g, '_');
		if (x === 'in_progress') return 'progress';
		if (x === 'done' || dbStatus === 'Решено') return 'closed';
		return 'new';
	}

	/** data-admin-state → DB status */
	function uiToDbStatus(uiState) {
		if (uiState === 'progress') return 'in_progress';
		if (uiState === 'closed') return 'done';
		return 'new';
	}

	function uiStateToLabel(uiState) {
		if (uiState === 'progress') return 'В работе';
		if (uiState === 'closed') return 'Завершено';
		return 'Новая';
	}

	function buildBodyFromRow(tr) {
		var keys = ['company', 'contact', 'email', 'phone', 'service', 'status', 'comment', 'date'];
		var parts = keys.map(function (key) {
			var val = tr.getAttribute('data-detail-' + key);
			if (val == null || val === '') return '';
			var label = LABELS[key] || key;
			return '<dt>' + label + '</dt><dd>' + String(val).replace(/</g, '&lt;') + '</dd>';
		});
		return '<dl>' + parts.join('') + '</dl>';
	}

	function openModal(title, html, row) {
		modalLinkedRow = row || null;
		if (!overlay) return;
		if (titleEl) titleEl.textContent = title;
		if (bodyEl) bodyEl.innerHTML = html;
		overlay.classList.add('is-open');
		overlay.setAttribute('aria-hidden', 'false');
		document.body.style.overflow = 'hidden';
	}

	function closeModal() {
		modalLinkedRow = null;
		if (!overlay) return;
		overlay.classList.remove('is-open');
		overlay.setAttribute('aria-hidden', 'true');
		document.body.style.overflow = '';
	}

	function updateStatusCell(tr, state) {
		var cell = tr.cells[5];
		if (!cell) return;
		var tag = cell.querySelector('.admin-tag');
		if (!tag) return;
		if (state === 'new') {
			tag.className = 'admin-tag admin-tag-new';
			tag.textContent = 'Новая';
		} else if (state === 'progress') {
			tag.className = 'admin-tag admin-tag-progress';
			tag.textContent = 'В работе';
		} else {
			tag.className = 'admin-tag admin-tag-done';
			tag.textContent = 'Завершено';
		}
		tr.setAttribute('data-detail-status', tag.textContent);
		tr.setAttribute('data-admin-state', state);
	}

	function renderActions(tr) {
		var state = tr.getAttribute('data-admin-state');
		var wrap = tr.querySelector('.admin-table-actions');
		if (!wrap) return;
		if (state === 'closed') {
			wrap.innerHTML =
				'<button type="button" class="admin-btn admin-btn-ghost" data-admin-action="reopen">Открыть снова</button>';
		} else if (state === 'progress') {
			wrap.innerHTML =
				'<button type="button" class="admin-btn admin-btn-outline" data-admin-action="open">Открыть</button>' +
				'<button type="button" class="admin-btn admin-btn-ghost" data-admin-action="close">Завершить</button>';
		} else {
			wrap.innerHTML =
				'<button type="button" class="admin-btn admin-btn-outline" data-admin-action="open">Открыть</button>' +
				'<button type="button" class="admin-btn admin-btn-primary" data-admin-action="to-work">В работу</button>';
		}
	}

	function setRowState(tr, state) {
		updateStatusCell(tr, state);
		renderActions(tr);
		syncStats();
		applyFilters();
	}

	function syncStats() {
		var rows = tbody ? tbody.querySelectorAll('.admin-ticket-row') : [];
		var n = 0;
		var p = 0;
		rows.forEach(function (r) {
			var s = r.getAttribute('data-admin-state');
			if (s === 'new') n++;
			else if (s === 'progress') p++;
		});
		var elN = document.getElementById('adminStatNew');
		var elP = document.getElementById('adminStatProgress');
		var elT = document.getElementById('adminStatTotal');
		if (elN) elN.textContent = String(n);
		if (elP) elP.textContent = String(p);
		if (elT) elT.textContent = String(rows.length);
	}

	function applyFilters() {
		if (!tbody) return;
		var q = (searchInput && searchInput.value.trim().toLowerCase()) || '';
		var f = (filterSelect && filterSelect.value) || '';
		var map = { new: 'new', progress: 'progress', done: 'closed' };
		var wantState = map[f];
		tbody.querySelectorAll('.admin-ticket-row').forEach(function (row) {
			var state = row.getAttribute('data-admin-state');
			var stateOk = !wantState || state === wantState;
			var textOk = !q || row.textContent.toLowerCase().indexOf(q) !== -1;
			row.style.display = stateOk && textOk ? '' : 'none';
		});
	}

	function exportVisibleRowsCsv() {
		if (!tbody) return;
		var rows = tbody.querySelectorAll('.admin-ticket-row');
		var lines = [['№', 'Дата', 'Клиент', 'Email', 'Компания', 'Услуга', 'Статус'].join(';')];
		function esc(s) {
			s = String(s || '').replace(/"/g, '""');
			return '"' + s + '"';
		}
		rows.forEach(function (row) {
			if (row.style.display === 'none') return;
			var num = row.querySelector('.admin-table-num');
			var date = row.cells[1] ? row.cells[1].textContent.trim() : '';
			var clientCell = row.cells[2];
			var client = '';
			var email = row.getAttribute('data-detail-email') || '';
			if (clientCell) {
				var linesClient = clientCell.innerText.split('\n');
				client = (linesClient[0] || '').trim();
			}
			var company = row.cells[3] ? row.cells[3].textContent.trim() : '';
			var service = row.cells[4] ? row.cells[4].textContent.trim() : '';
			var status = row.getAttribute('data-detail-status') || '';
			lines.push(
				[esc(num ? num.textContent : ''), esc(date), esc(client), esc(email), esc(company), esc(service), esc(status)].join(';')
			);
		});
		var blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
		var a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = 'zayavki-sysadmins-' + new Date().toISOString().slice(0, 10) + '.csv';
		a.click();
		URL.revokeObjectURL(a.href);
		showToast('Файл CSV скачан (видимые строки таблицы).');
	}

	function escapeHtml(s) {
		return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
	}

	function buildRowFromApplication(app) {
		var tr = document.createElement('tr');
		tr.className = 'admin-ticket-row';
		tr.setAttribute('data-application-id', app.id || '');
		var uiState = dbToUiState(app.status);
		tr.setAttribute('data-admin-state', uiState);
		var shortId = (app.id || '').toString().slice(-4);
		var title = 'Заявка №' + shortId;
		tr.setAttribute('data-detail-title', title);
		tr.setAttribute('data-detail-company', app.company || '');
		tr.setAttribute('data-detail-contact', app.name || '');
		tr.setAttribute('data-detail-email', app.email || '');
		tr.setAttribute('data-detail-phone', app.phone || '');
		tr.setAttribute('data-detail-service', app.service || '');
		tr.setAttribute('data-detail-comment', app.comment || '');
		tr.setAttribute('data-detail-date', formatDate(app.created_at));
		tr.setAttribute('data-detail-status', uiStateToLabel(uiState));

		var name = app.name || '—';
		var email = app.email || '';
		var company = escapeHtml(app.company || '—');
		var service = escapeHtml(app.service || '—');
		var dateStr = formatDate(app.created_at);

		tr.innerHTML =
			'<td><span class="admin-table-num">№' + escapeHtml(shortId) + '</span></td>' +
			'<td><span class="admin-table-muted">' + escapeHtml(dateStr) + '</span></td>' +
			'<td>' +
			escapeHtml(name) +
			(email ? '<br /><span class="admin-table-muted">' + escapeHtml(email) + '</span>' : '') +
			'</td>' +
			'<td>' +
			company +
			'</td>' +
			'<td>' +
			service +
			'</td>' +
			'<td><span class="admin-tag"></span></td>' +
			'<td><div class="admin-table-actions"></div></td>';

		updateStatusCell(tr, uiState);
		renderActions(tr);
		return tr;
	}

	function renderApplicationsFromData(apps) {
		if (!tbody) return;
		tbody.innerHTML = '';
		if (!apps || !apps.length) {
			var empty = document.createElement('tr');
			empty.innerHTML =
				'<td colspan="7" class="admin-table-muted" style="text-align:center;padding:28px;">Заявок пока нет</td>';
			tbody.appendChild(empty);
			syncStats();
			return;
		}
		apps.forEach(function (app) {
			tbody.appendChild(buildRowFromApplication(app));
		});
		syncStats();
		applyFilters();
	}

	function fetchApplicationsAndRender() {
		if (!supabaseClient || !tbody) return;
		tbody.innerHTML =
			'<tr id="adminTicketsLoading"><td colspan="7" class="admin-table-muted" style="text-align:center;padding:28px;">Загрузка…</td></tr>';
		supabaseClient
			.from('applications')
			.select('*')
			.order('created_at', { ascending: false })
			.then(function (r) {
				if (r.error) {
					tbody.innerHTML =
						'<tr><td colspan="7" class="admin-table-muted" style="text-align:center;padding:28px;">Ошибка загрузки: ' +
						escapeHtml(r.error.message) +
						'</td></tr>';
					showToast('Не удалось загрузить заявки.');
					return;
				}
				renderApplicationsFromData(r.data || []);
			});
	}

	function persistRowStatus(tr, newUiState, okMsg) {
		var id = tr.getAttribute('data-application-id');
		if (!dbMode || !supabaseClient || !id) {
			setRowState(tr, newUiState);
			if (okMsg) showToast(okMsg);
			return;
		}
		var dbStatus = uiToDbStatus(newUiState);
		supabaseClient
			.from('applications')
			.update({ status: dbStatus })
			.eq('id', id)
			.then(function (r) {
				if (r.error) {
					showToast('Ошибка: ' + (r.error.message || 'не удалось сохранить'));
					return;
				}
				setRowState(tr, newUiState);
				if (okMsg) showToast(okMsg);
			});
	}

	function initDatabaseMode() {
		if (typeof window.supabase === 'undefined' || !window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
			showToast('Supabase не настроен — заявки из БД недоступны.');
			return;
		}
		supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
		var lo = document.getElementById('adminLogoutLink');
		if (lo) {
			lo.addEventListener('click', function (e) {
				e.preventDefault();
				supabaseClient.auth.signOut().then(function () {
					window.location.href = 'login.html';
				});
			});
		}
		supabaseClient.auth.getSession().then(function (res) {
			var session = res.data && res.data.session;
			var user = session && session.user;
			if (!user) {
				window.location.href = 'login.html';
				return;
			}
			supabaseClient
				.from('profiles')
				.select('is_admin')
				.eq('id', user.id)
				.maybeSingle()
				.then(function (pr) {
					if (pr.error) {
						console.error(pr.error);
						showToast('Проверьте колонку is_admin (файл supabase/admin-setup.sql).');
						if (tbody) {
							tbody.innerHTML =
								'<tr><td colspan="7" class="admin-table-muted" style="text-align:center;padding:28px;">Ошибка доступа к профилю</td></tr>';
						}
						return;
					}
					var row = pr.data;
					if (!row || !row.is_admin) {
						window.location.href = 'profile.html';
						return;
					}
					dbMode = true;
					fetchApplicationsAndRender();
				});
		});
	}

	/* Делегирование: таблица заявок */
	if (tbody) {
		tbody.addEventListener('click', function (e) {
			var btn = e.target.closest('[data-admin-action]');
			if (!btn || !tbody.contains(btn)) return;
			var action = btn.getAttribute('data-admin-action');
			var row = btn.closest('tr.admin-ticket-row');
			if (!row) return;

			if (action === 'open') {
				var t = row.getAttribute('data-detail-title') || 'Заявка';
				openModal(t, buildBodyFromRow(row), row);
				return;
			}
			if (action === 'to-work') {
				persistRowStatus(row, 'progress', 'Статус «В работе» сохранён — клиент увидит в личном кабинете.');
				return;
			}
			if (action === 'close') {
				persistRowStatus(row, 'closed', 'Заявка завершена — у клиента отобразится «Завершено».');
				return;
			}
			if (action === 'reopen') {
				persistRowStatus(row, 'new', 'Заявка снова «Новая».');
				return;
			}
		});
	}

	if (btnClose) btnClose.addEventListener('click', closeModal);
	if (btnCloseFooter) btnCloseFooter.addEventListener('click', closeModal);
	if (overlay) {
		overlay.addEventListener('click', function (e) {
			if (e.target === overlay) closeModal();
		});
	}
	document.addEventListener('keydown', function (e) {
		if (e.key === 'Escape' && overlay && overlay.classList.contains('is-open')) closeModal();
	});

	if (btnWriteClient) {
		btnWriteClient.addEventListener('click', function () {
			var email = modalLinkedRow ? modalLinkedRow.getAttribute('data-detail-email') : '';
			var contact = modalLinkedRow ? modalLinkedRow.getAttribute('data-detail-contact') : '';
			closeModal();
			if (email) {
				showToast('Черновик: ответ для ' + (contact || email) + ' (' + email + ')');
			} else {
				showToast('Клиент выбран.');
			}
		});
	}

	if (searchInput) searchInput.addEventListener('input', applyFilters);
	if (filterSelect) filterSelect.addEventListener('change', applyFilters);

	if (btnRefresh) {
		btnRefresh.addEventListener('click', function () {
			if (dbMode) {
				fetchApplicationsAndRender();
			} else {
				applyFilters();
			}
			if (tableWrap) {
				tableWrap.classList.remove('admin-table-flash');
				void tableWrap.offsetWidth;
				tableWrap.classList.add('admin-table-flash');
			}
			showToast('Список обновлён.');
		});
	}

	if (btnExport) {
		btnExport.addEventListener('click', exportVisibleRowsCsv);
	}

	initDatabaseMode();
})();
