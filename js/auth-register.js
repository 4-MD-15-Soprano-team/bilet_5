(function () {
	if (typeof window.supabase === 'undefined' || !window.SUPABASE_URL) return;

	var form = document.querySelector('.auth-form');
	if (!form) return;

	var supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

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

		supabase.auth.signUp({ email: email, password: password })
			.then(function (res) {
				if (res.error) {
					alert(res.error.message || 'Ошибка регистрации.');
					if (btn) { btn.disabled = false; btn.textContent = 'Зарегистрироваться'; }
					return;
				}
				var user = res.data.user;
				if (!user) {
					if (btn) { btn.disabled = false; btn.textContent = 'Зарегистрироваться'; }
					return;
				}
				return supabase.from('profiles').upsert({
					id: user.id,
					email: email,
					name: name || null,
					phone: phone || null
				}, { onConflict: 'id' });
			})
			.then(function (res) {
				if (res && res.error) {
					console.warn('Profile upsert:', res.error);
				}
				setTimeout(function () {
					window.location.href = 'profile.html';
				}, 400);
			})
			.catch(function (err) {
				console.error(err);
				alert('Ошибка при регистрации.');
				if (btn) { btn.disabled = false; btn.textContent = 'Зарегистрироваться'; }
			});
	});
})();
