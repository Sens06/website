Скриншоты для кейсов (показываются в pop-up).

Куда класть: эту папку (assets/cases/).
Формат: JPG / PNG / WEBP. Видео и PSD сюда не кладём (их режет .gitignore).
Имена — латиницей, понятные: например remont-kabinet.jpg, avito-stats.png.

Совет: сжимай скрины перед загрузкой (ширина ~1200px, вес до ~300 КБ),
иначе модалка будет грузиться медленно. Удобно через squoosh.app или tinypng.com.

Как вставить скрин в кейс — внутри карточки в index.html, в блоке
<template class="case-full"> своего кейса:

  <figure>
    <img src="assets/cases/remont-kabinet.jpg" alt="Рекламный кабинет: результаты за месяц">
    <figcaption>Заявки за первый месяц</figcaption>
  </figure>

Можно несколько скринов подряд. Подпись (figcaption) — по желанию.
