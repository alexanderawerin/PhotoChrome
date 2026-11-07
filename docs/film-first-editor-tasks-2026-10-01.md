# Photochrome: задачи для облачного агента

> Историческое разбиение согласованной спецификации от 1 октября 2026 года. Основная реализация уже находится в main; текущие результаты и оставшиеся условия приёмки перечислены в [ROADMAP.md](ROADMAP.md) и [отчёте приёмки](film-first-acceptance.md). Приведённые ниже стартовые зависимости и формулировки статуса относятся к исходному плану.

Дата: 2026-10-01. Основная спецификация: [GitHub #4](https://github.com/alexanderawerin/PhotoChrome/issues/4). Все задачи опубликованы на GitHub с меткой ready-for-agent; родительские связи и Blocked by заданы также средствами GitHub.

## Опубликованные задачи

| Задача | Результат | Blocked by |
| --- | --- | --- |
| [#5](https://github.com/alexanderawerin/PhotoChrome/issues/5) | Wait for required film resources before preview and export | Нет |
| [#6](https://github.com/alexanderawerin/PhotoChrome/issues/6) | Enforce editor command restrictions for buttons and shortcuts | Нет |
| [#7](https://github.com/alexanderawerin/PhotoChrome/issues/7) | Preserve alpha and align CPU, worker, and WebGL processing | Нет |
| [#8](https://github.com/alexanderawerin/PhotoChrome/issues/8) | Preserve video audio or require explicit silent-export consent | Нет |
| [#9](https://github.com/alexanderawerin/PhotoChrome/issues/9) | Offer Original and ten base films in both main editors | #5, #6, #7 |
| [#10](https://github.com/alexanderawerin/PhotoChrome/issues/10) | Add film-scoped Recipes and Manual with one Apply/Cancel draft | #9 |
| [#11](https://github.com/alexanderawerin/PhotoChrome/issues/11) | Add reversible video geometry to preview and MP4 export | #9 |
| [#12](https://github.com/alexanderawerin/PhotoChrome/issues/12) | Apply color to all photos and export every loaded photo | #10 |
| [#13](https://github.com/alexanderawerin/PhotoChrome/issues/13) | Finish film-first cleanup, documentation, and release acceptance | #10, #11, #12, #8 |
| [#14](https://github.com/alexanderawerin/PhotoChrome/issues/14) | Measure and improve preview responsiveness after film-first delivery | #13 |
| [#15](https://github.com/alexanderawerin/PhotoChrome/issues/15) | Measure and bound memory for realistic photo batches | #13 |

## Порядок работы

- Начальный фронт: #5, #6, #7 и #8. Рекомендуемый первый участок — #5: готовность ресурсов перед preview и экспортом.
- #9 начинается после интеграции #5–#7. Затем #10 и #11 могут выполняться независимо; #12 требует #10.
- #13 проверяет полный продукт после #8, #10, #11 и #12. Проверки недоступных браузеров/реальных устройств остаются явно указанными условиями приёмки.
- #14 и #15 — отдельные последующие работы по preview и памяти, после #13. Они не заменяют обязательные исправления и геометрию видео.
- Готовность к старту определяется выполненными зависимостями и наличием их изменений в рабочей базе. Одна метка ready-for-agent или закрытая задача этого не доказывает.

## Передача работы

Полная спецификация и критерии каждой задачи доступны в GitHub, поэтому облачному агенту не нужны локальные незакоммиченные документы этого чата. Перед началом он должен прочитать #4, выбранную задачу и правила репозитория, проверить актуальный main и уже влитую уборку PR #3.

Выполнять один завершённый участок за раз; сохранять чужие изменения; проверять наблюдаемое поведение и реально экспортированные файлы. Обновлять затронутые тесты, выполнять узкие E2E и обязательные CI-проверки перед UI push. Указывать, что реально проверено, и какие проверки остаются открытыми.

Спецификация #4 остаётся открытой; её содержание не переписано при разбиении. Этот индекс описывает опубликованный план, а не выполненную реализацию.
