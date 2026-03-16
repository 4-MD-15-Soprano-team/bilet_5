(function () {
	var form = document.querySelector('.auth-form');
	if (!form) return;

	var passwordInput = document.getElementById('login-password');
	var toggleBtn = document.getElementById('login-password-toggle');
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

		var emailEl = document.getElementById('login-email');
		var passwordEl = document.getElementById('login-password');
		var email = emailEl && emailEl.value ? emailEl.value.trim() : '';
		var password = passwordEl && passwordEl.value ? passwordEl.value : '';

		if (!email || !password) {
			alert('Введите email и пароль.');
			return;
		}

		var btn = form.querySelector('button[type="submit"]');
		if (btn) {
			btn.disabled = true;
			btn.textContent = 'Вход…';
		}

		supabase.auth.signInWithPassword({ email: email, password: password })
			.then(function (res) {
				if (res.error) {
					alert(res.error.message || 'Ошибка входа.');
					if (btn) { btn.disabled = false; btn.textContent = 'Войти'; }
					return;
				}
				window.location.href = 'profile.html';
			})
			.catch(function (err) {
				console.error(err);
				alert('Ошибка при входе.');
				if (btn) { btn.disabled = false; btn.textContent = 'Войти'; }
			});
	});
})();
