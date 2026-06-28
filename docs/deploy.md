# Публикация на GitHub Pages

Сайт — статика в корне репозитория, публикуется через GitHub Pages.

## Первая настройка (один раз)

1. Запушить файлы в ветку `main`.
2. GitHub → репозиторий → **Settings → Pages**.
3. **Source**: `Deploy from a branch`. **Branch**: `main`, папка `/ (root)`. Сохранить.
4. Через 1–2 минуты сайт доступен по адресу `https://<user>.github.io/<repo>/`.

Для `Sens06/website` → https://sens06.github.io/website/

## Обновление сайта

```powershell
git add .
git commit -m "что изменили"
git push
```

GitHub Pages пересоберёт автоматически за ~1 минуту.

## Своя доменная зона (опционально)

Положить файл `CNAME` в корень с доменом (например `klac.ru`) и настроить DNS у регистратора (CNAME на `<user>.github.io`).

## Пути

Все ссылки на ресурсы — **относительные** (`css/styles.css`, `js/main.js`), иначе на GitHub Pages с подпапкой `/website/` они сломаются.