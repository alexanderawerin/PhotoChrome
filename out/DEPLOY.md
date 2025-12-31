# Photochrome v1.2.0 - Deployment Instructions

## 📦 Содержимое

Эта папка содержит production build приложения Photochrome v1.2.0, готовый к загрузке на сервер.

## 🚀 Инструкция по деплою

### Вариант 1: Загрузка через FTP/SFTP
1. Подключитесь к серверу через FTP-клиент (FileZilla, Cyberduck и т.д.)
2. Загрузите **всё содержимое** папки `out` в корневую директорию сайта (обычно `public_html` или `www`)
3. Убедитесь, что файл `.htaccess` также загружен (он может быть скрыт)

### Вариант 2: Загрузка через SSH
```bash
# Распаковать архив на сервере
tar -xzf photochrome-v1.2.0.tar.gz -C /path/to/web/root
```

### Вариант 3: Использовать готовый архив
Загрузите файл `photochrome-v1.2.0.tar.gz` на сервер и распакуйте его.

## ✅ Проверка после деплоя

1. Откройте сайт в браузере: https://photochrome.netdesigner.ru
2. Проверьте работу основных функций:
   - Загрузка изображений
   - Применение пресетов
   - Экспорт изображений
   - Работа на мобильных устройствах

## 📋 Требования к серверу

- **Web-сервер**: Apache или Nginx
- **PHP**: Не требуется (статический сайт)
- **HTTPS**: Рекомендуется для полной функциональности
- **Модули Apache** (если используется):
  - mod_rewrite (для SPA routing)
  - mod_deflate (для сжатия)
  - mod_expires (для кэширования)
  - mod_headers (для security headers)

## 🔧 Конфигурация

### Apache (.htaccess уже включён)
Файл `.htaccess` настроен автоматически и включает:
- URL rewriting для SPA
- Gzip компрессию
- Браузерное кэширование
- Security headers

### Nginx
Если используете Nginx, добавьте в конфигурацию:

```nginx
location / {
    try_files $uri $uri/ /index.html;

    # Gzip compression
    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;

    # Browser caching
    location ~* \.(jpg|jpeg|png|svg|ico)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location ~* \.(css|js)$ {
        expires 1M;
        add_header Cache-Control "public";
    }

    # Security headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
```

## 🆕 Что нового в версии 1.2.0

- ✨ Галерея миниатюр под основным превью на десктопе
- 🖼️ Живое превью рецептов в миниатюрах
- 📱 Улучшенный мобильный интерфейс с кнопками внизу
- ⚡ Индикатор загрузки при применении пресетов
- 🎯 Кнопка "Apply to all" на панели инструментов
- 🐛 Исправлено переключение между изображениями

## 📞 Поддержка

При возникновении проблем проверьте:
1. Все файлы загружены корректно
2. Файл `.htaccess` присутствует (для Apache)
3. Права доступа к файлам установлены правильно (644 для файлов, 755 для папок)
4. Browser console на наличие ошибок

---

**Версия**: 1.2.0
**Дата сборки**: 2025-12-31
**URL**: https://photochrome.netdesigner.ru
