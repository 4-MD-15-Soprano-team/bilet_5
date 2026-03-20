(function () {
	var form = document.querySelector('.auth-form');
	if (!form) return;

	function resetBtn(btn) {
		if (btn) {
			btn.disabled = false;
			btn.textContent = 'Зарегистрироваться';
		}
	}

	function translateRegisterError(err) {
		if (!err) return 'Ошибка регистрации.';
		var msg = (err.message || '').toLowerCase();
		if (msg.indexOf('already registered') !== -1 || msg.indexOf('already been registered') !== -1) {
			return 'Этот email уже зарегистрирован. Войдите на странице «Вход» или нажмите «Забыли пароль» в Supabase / смените пароль.';
		}
		if (msg.indexOf('password') !== -1 && msg.indexOf('short') !== -1) {
			return 'Пароль слишком короткий. Укажите более длинный пароль (как в требованиях проекта).';
		}
		return err.message || 'Ошибка регистрации.';
	}

	// Глаз: показать/скрыть пароль
	var passwordInput = document.getElementById('reg-password');
	var toggleBtn = document.getElementById('reg-password-toggle');
	if (passwordInput && toggleBtn) {
		var iconEye = toggleBtn.querySelector('.auth-password-icon-eye');
		var iconEyeOff = toggleBtn.querySelector('.auth-password-icon-eye-off');
		toggleBtn.addEventListener('click', function () {
			var isPassword = passwordInput.type === 'password';
			passwordInput.type = isPassword ? 'text' : 'password';
			toggleBtn.setAttribute('aria-label', isPassword ? 'Скрыть пароль' : 'Показать пароль');
			toggleBtn.setAttribute('title', isPassword ? 'Скрыть пароль' : 'Показать пароль');
			if (iconEye) iconEye.style.display = isPassword ? 'none' : 'block';
			if (iconEyeOff) iconEyeOff.style.display = isPassword ? 'block' : 'none';
		});
	}

	form.addEventListener('submit', function (e) {
		e.preventDefault();

		if (typeof window.supabase === 'undefined' || !window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
			alert('Supabase не настроен. В настройках репозитория добавьте Secrets: SUPABASE_URL и SUPABASE_ANON_KEY, затем задеплойте заново.');
			return;
		}

		var supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

		var emailEl = document.getElementById('reg-email');
		var passwordEl = document.getElementById('reg-password');
		var nameEl = document.getElementById('reg-name');
		var phoneEl = document.getElementById('reg-phone');

		var email = emailEl && emailEl.value ? emailEl.value.trim() : '';
		var password = passwordEl && passwordEl.value ? passwordEl.value : '';
		var name = nameEl && nameEl.value ? nameEl.value.trim() : '';
		var phone = phoneEl && phoneEl.value ? phoneEl.value.trim() : '';

		if (!email || !password) {
			alert('Заполните email и пароль.');
			return;
		}

		var btn = form.querySelector('button[type="submit"]');
		if (btn) {
			btn.disabled = true;
			btn.textContent = 'Регистрация…';
		}

		supabase.auth
			.signUp({ email: email, password: password })
			.then(function (res) {
				if (res.error) {
					alert(translateRegisterError(res.error));
					resetBtn(btn);
					return Promise.reject(new Error('register_failed'));
				}
				var user = res.data && res.data.user;
				var session = res.data && res.data.session;
				// Если включено подтверждение email, user может быть, а session — null
				if (!user) {
					alert(
						'Регистрация принята. Если в проекте включено подтверждение email, откройте письмо и перейдите по ссылке, затем войдите на странице «Вход».'
					);
					resetBtn(btn);
					return Promise.reject(new Error('no_user'));
				}
				return supabase
					.from('profiles')
					.upsert(
						{
							id: user.id,
							email: email,
							name: name || null,
							phone: phone || null
						},
						{ onConflict: 'id' }
					)
					.then(function (upRes) {
						return { upRes: upRes, session: session };
					});
			})
			.then(function (payload) {
				if (!payload) return;
				if (payload.upRes && payload.upRes.error) {
					console.warn('Profile upsert:', payload.upRes.error);
				}
				if (!payload.session) {
					alert(
						'Аккаунт создан. Подтвердите email по ссылке из письма (если настроено в Supabase), затем войдите на странице «Вход».'
					);
					resetBtn(btn);
					return;
				}
				setTimeout(function () {
					window.location.href = 'profile.html';
				}, 400);
			})
			.catch(function (err) {
				if (err && (err.message === 'register_failed' || err.message === 'no_user')) return;
				console.error(err);
				alert('Ошибка при регистрации.');
				resetBtn(btn);
			});
	});
})();
