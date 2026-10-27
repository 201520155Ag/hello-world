/**
 * Main City — translations (owner C).
 * One flat dictionary per language with an identical key set; `en` is authoritative.
 * Pure except `setLang`, which writes `lang`/`dir` on <html> when a document exists.
 */

export const LANGS = Object.freeze([
  { id: 'en', label: 'English', dir: 'ltr' },
  { id: 'es', label: 'Español', dir: 'ltr' },
  { id: 'ru', label: 'Русский', dir: 'ltr' },
  { id: 'he', label: 'עברית', dir: 'rtl' },
]);

const en = {
  'app.title': 'Main City', 'app.tagline': 'Build a city on your own, right in your browser.',
  'landing.new': 'New city', 'landing.continue': 'Continue', 'landing.openShared': 'Open shared city',
  'landing.name': 'City name', 'landing.continueMeta': '{name} · {pop} people · {date}',
  'landing.noSave': 'No saved city yet', 'landing.saveDate': '{m}, year {y}',
  'hud.cash': 'Cash', 'hud.pop': 'Population', 'hud.jobs': 'Jobs', 'hud.approval': 'Approval', 'hud.date': 'Date',
  'hud.demand': 'Demand', 'hud.r': 'R', 'hud.c': 'C', 'hud.i': 'I',
  'speed.0': 'Pause', 'speed.1': 'Normal speed', 'speed.2': 'Fast', 'speed.3': 'Fastest',
  'tool.pan': 'Pan', 'tool.inspect': 'Inspect', 'tool.road': 'Road', 'tool.zone_r': 'Residential zone',
  'tool.zone_c': 'Commercial zone', 'tool.zone_i': 'Industrial zone', 'tool.bulldoze': 'Bulldoze',
  'tool.power': 'Power plant', 'tool.water': 'Water tower', 'tool.park': 'Park', 'tool.police': 'Police station',
  'tool.fire': 'Fire station', 'tool.school': 'School', 'tool.hospital': 'Hospital',
  'tool.cost': 'Cost: {n}', 'tool.upkeep': 'Upkeep: {n}/month', 'tool.radius': 'Radius: {n}', 'tool.key': 'Key: {k}',
  'overlay.label': 'Overlay', 'overlay.none': 'None', 'overlay.power': 'Power', 'overlay.water': 'Water',
  'overlay.value': 'Land value', 'overlay.pollution': 'Pollution', 'overlay.block': 'Growth blockers',
  'panel.inspector': 'Inspector', 'panel.budget': 'Budget', 'panel.help': 'Help', 'panel.save': 'Save & share',
  'panel.close': 'Close',
  'inspect.none': 'Select a tile to inspect it.', 'inspect.coords': 'Tile {x}, {y}', 'inspect.grass': 'Grass',
  'inspect.tree': 'Trees', 'inspect.water': 'Water', 'inspect.road': 'Road', 'inspect.lot': '{zone} lot (empty)',
  'inspect.building': '{zone} building, level {level}',
  'zone.r': 'Residential', 'zone.c': 'Commercial', 'zone.i': 'Industrial',
  'inspect.residents': 'Residents: {n}', 'inspect.jobs': 'Jobs: {n}', 'inspect.powered': 'Powered',
  'inspect.unpowered': 'No power', 'inspect.watered': 'Water supplied', 'inspect.unwatered': 'No water',
  'inspect.access': 'Road access', 'inspect.noAccess': 'No road access', 'inspect.landValue': 'Land value: {n}',
  'inspect.pollution': 'Pollution: {n}', 'inspect.services': 'Services: {list}', 'inspect.noServices': 'Services: none',
  'inspect.whyNot': 'Not growing: {reason}', 'inspect.growing': 'Growing',
  'inspect.service': '{name} — radius {radius}, upkeep {upkeep}/month',
  'block.road': 'no road next to it', 'block.power': 'no power', 'block.water': 'no water', 'block.demand': 'low demand',
  'block.value': 'land value too low', 'block.pollution': 'too much pollution', 'block.full': 'fully developed',
  'hint.road': 'Build a road touching this lot.', 'hint.power': 'Place a power plant within range.',
  'hint.powerCapacity': 'Your power plants are overloaded — build another.',
  'hint.water': 'Place a water tower within range (needed above level 1).',
  'hint.waterCapacity': 'Your water towers are overloaded — build another.',
  'hint.demand.r': 'Residents need jobs — zone commercial or industrial.',
  'hint.demand.c': 'Shops need customers — zone more residential.',
  'hint.demand.i': 'Industry needs workers — zone residential, or add parks to cut pollution.',
  'hint.value': 'Parks, schools and hospitals raise land value.', 'hint.pollution': 'Move industry away or add parks.',
  'hint.full': 'This lot is at maximum level.',
  'budget.tax': 'Tax rate: {n}%', 'budget.lastMonth': 'Last month', 'budget.income': 'Income', 'budget.upkeep': 'Upkeep',
  'budget.interest': 'Interest', 'budget.net': 'Net', 'budget.power': 'Power: {use} / {cap}',
  'budget.water': 'Water: {use} / {cap}', 'budget.history': 'Cash, last {n} months',
  'budget.debt': 'In debt: 1% interest per month, approval −10.',
  'budget.cut': 'Below {n}: police, fire, schools, hospitals and parks are suspended.',
  'budget.waiting': 'Lots waiting: {road} need a road, {power} need power, {water} need water, {demand} low demand, {value} low land value',
  'save.save': 'Save', 'save.load': 'Load', 'save.saved': 'City saved.', 'save.loaded': 'City loaded.',
  'save.none': 'No saved city.', 'save.failed': 'Could not save — storage is unavailable.',
  'save.confirmLoad': 'Load the saved city? Unsaved progress is lost.',
  'save.confirmNew': 'Start a new city? The current city is lost unless saved.',
  'share.title': 'Share', 'share.code': 'City code', 'share.copyCode': 'Copy code', 'share.copyLink': 'Copy link',
  'share.import': 'Import', 'share.paste': 'Paste a city code or link here', 'share.copied': 'Copied to clipboard.',
  'share.copyFailed': 'Copy failed — select the text and copy it manually.',
  'share.invalid': 'That is not a valid Main City code.',
  'share.loaded': 'Shared city loaded. It is not autosaved until you make a change.',
  'share.note': 'Sharing is by city code or link only — there is no live multiplayer.',
  'help.controls': 'Controls',
  'help.mouse': 'Mouse: left click or drag uses the tool, right or middle drag pans, wheel zooms.',
  'help.touch': 'Touch: tap to place, drag with the Pan tool to move, pinch to zoom, two fingers always pan, long-press to inspect.',
  'help.keys': 'R road · Z cycle zones · B bulldoze · I inspect · Space pause · 1/2/3 speed · Esc cancel · O overlay · H help · WASD pan · arrows move cursor · Enter build · +/− zoom · Ctrl+S save',
  'help.howTo': 'How to grow',
  'help.howToText': '1. Draw roads. 2. Zone lots touching roads. 3. Power them with a plant in range. 4. Add a water tower for taller buildings. 5. Balance homes and jobs — watch the RCI bars. 6. Parks and schools raise land value.',
  'help.legend': 'Legend', 'help.legend.r': 'Residential — green', 'help.legend.c': 'Commercial — blue',
  'help.legend.i': 'Industrial — orange',
  'help.legend.badges': 'Badges: lightning = no power, drop = no water, road sign = no road access',
  'help.blockers': 'Blocker overlay colours',
  'err.water': "Can't build on water.", 'err.occupied': 'That spot is occupied.',
  'err.money': 'Not enough money (limit {n}).', 'err.bounds': 'Outside the map.', 'err.nothing': 'Nothing to do here.',
  'err.save': 'The save data is damaged.', 'err.version': 'Made with a newer version of the game.',
  'err.storage': 'Storage is unavailable in this browser.', 'err.unexpected': 'Something went wrong.',
  'toast.welcome': 'Welcome to {name}! Draw a road and zone next to it.', 'toast.firstHouse': 'Your first residents moved in!',
  'toast.fire': 'Fire destroyed a building at {x}, {y}.', 'toast.debt': 'The city is in debt — interest is now charged.',
  'toast.debtCleared': 'Out of debt.', 'toast.servicesCut': 'Services suspended for lack of funds.',
  'toast.servicesRestored': 'Services restored.', 'toast.powerShort': 'Power shortage — build another plant.',
  'toast.waterShort': 'Water shortage — build another tower.',
  'skin.label': 'Map style', 'skin.grassland': 'Grassland', 'skin.desert': 'Desert', 'skin.snow': 'Snow', 'skin.night': 'Night',
  'lang.label': 'Language',
  'month.1': 'Jan', 'month.2': 'Feb', 'month.3': 'Mar', 'month.4': 'Apr', 'month.5': 'May', 'month.6': 'Jun',
  'month.7': 'Jul', 'month.8': 'Aug', 'month.9': 'Sep', 'month.10': 'Oct', 'month.11': 'Nov', 'month.12': 'Dec',
  'date.fmt': '{m} {d}, year {y}',
  'ui.yes': 'Yes', 'ui.no': 'No', 'ui.ok': 'OK', 'ui.cancel': 'Cancel',
  'a11y.canvas': 'City map. Pick a tool, move the cursor with the arrow keys and press Enter to build.',
  'a11y.toolbar': 'Build tools', 'a11y.speed': 'Game speed', 'a11y.zoomIn': 'Zoom in', 'a11y.zoomOut': 'Zoom out',
  'a11y.center': 'Fit map', 'a11y.rci': '{zone} demand {n} percent', 'a11y.toasts': 'Notifications', 'a11y.panels': 'Panels',
};

const es = {
  'app.title': 'Main City', 'app.tagline': 'Construye una ciudad por tu cuenta, directamente en tu navegador.',
  'landing.new': 'Nueva ciudad', 'landing.continue': 'Continuar', 'landing.openShared': 'Abrir ciudad compartida',
  'landing.name': 'Nombre de la ciudad', 'landing.continueMeta': '{name} · {pop} habitantes · {date}',
  'landing.noSave': 'Aún no hay ciudad guardada', 'landing.saveDate': '{m}, año {y}',
  'hud.cash': 'Dinero', 'hud.pop': 'Población', 'hud.jobs': 'Empleos', 'hud.approval': 'Aprobación', 'hud.date': 'Fecha',
  'hud.demand': 'Demanda', 'hud.r': 'R', 'hud.c': 'C', 'hud.i': 'I',
  'speed.0': 'Pausa', 'speed.1': 'Velocidad normal', 'speed.2': 'Rápido', 'speed.3': 'Muy rápido',
  'tool.pan': 'Mover', 'tool.inspect': 'Inspeccionar', 'tool.road': 'Carretera', 'tool.zone_r': 'Zona residencial',
  'tool.zone_c': 'Zona comercial', 'tool.zone_i': 'Zona industrial', 'tool.bulldoze': 'Demoler',
  'tool.power': 'Central eléctrica', 'tool.water': 'Depósito de agua', 'tool.park': 'Parque', 'tool.police': 'Comisaría',
  'tool.fire': 'Estación de bomberos', 'tool.school': 'Escuela', 'tool.hospital': 'Hospital',
  'tool.cost': 'Coste: {n}', 'tool.upkeep': 'Mantenimiento: {n}/mes', 'tool.radius': 'Radio: {n}', 'tool.key': 'Tecla: {k}',
  'overlay.label': 'Capa', 'overlay.none': 'Ninguna', 'overlay.power': 'Electricidad', 'overlay.water': 'Agua',
  'overlay.value': 'Valor del suelo', 'overlay.pollution': 'Contaminación', 'overlay.block': 'Bloqueos de crecimiento',
  'panel.inspector': 'Inspector', 'panel.budget': 'Presupuesto', 'panel.help': 'Ayuda', 'panel.save': 'Guardar y compartir',
  'panel.close': 'Cerrar',
  'inspect.none': 'Selecciona una casilla para inspeccionarla.', 'inspect.coords': 'Casilla {x}, {y}', 'inspect.grass': 'Hierba',
  'inspect.tree': 'Árboles', 'inspect.water': 'Agua', 'inspect.road': 'Carretera', 'inspect.lot': 'Parcela {zone} (vacía)',
  'inspect.building': 'Edificio {zone}, nivel {level}',
  'zone.r': 'residencial', 'zone.c': 'comercial', 'zone.i': 'industrial',
  'inspect.residents': 'Habitantes: {n}', 'inspect.jobs': 'Empleos: {n}', 'inspect.powered': 'Con electricidad',
  'inspect.unpowered': 'Sin electricidad', 'inspect.watered': 'Con agua', 'inspect.unwatered': 'Sin agua',
  'inspect.access': 'Acceso por carretera', 'inspect.noAccess': 'Sin acceso por carretera', 'inspect.landValue': 'Valor del suelo: {n}',
  'inspect.pollution': 'Contaminación: {n}', 'inspect.services': 'Servicios: {list}', 'inspect.noServices': 'Servicios: ninguno',
  'inspect.whyNot': 'No crece: {reason}', 'inspect.growing': 'Creciendo',
  'inspect.service': '{name} — radio {radius}, mantenimiento {upkeep}/mes',
  'block.road': 'sin carretera al lado', 'block.power': 'sin electricidad', 'block.water': 'sin agua', 'block.demand': 'poca demanda',
  'block.value': 'valor del suelo demasiado bajo', 'block.pollution': 'demasiada contaminación', 'block.full': 'totalmente desarrollada',
  'hint.road': 'Construye una carretera que toque esta parcela.', 'hint.power': 'Coloca una central eléctrica dentro del alcance.',
  'hint.powerCapacity': 'Tus centrales eléctricas están sobrecargadas: construye otra.',
  'hint.water': 'Coloca un depósito de agua dentro del alcance (necesario por encima del nivel 1).',
  'hint.waterCapacity': 'Tus depósitos de agua están sobrecargados: construye otro.',
  'hint.demand.r': 'Los habitantes necesitan empleo: zonifica comercio o industria.',
  'hint.demand.c': 'Las tiendas necesitan clientes: zonifica más zonas residenciales.',
  'hint.demand.i': 'La industria necesita trabajadores: zonifica zonas residenciales o añade parques para reducir la contaminación.',
  'hint.value': 'Parques, escuelas y hospitales aumentan el valor del suelo.', 'hint.pollution': 'Aleja la industria o añade parques.',
  'hint.full': 'Esta parcela está en el nivel máximo.',
  'budget.tax': 'Impuestos: {n}%', 'budget.lastMonth': 'Último mes', 'budget.income': 'Ingresos', 'budget.upkeep': 'Mantenimiento',
  'budget.interest': 'Intereses', 'budget.net': 'Neto', 'budget.power': 'Electricidad: {use} / {cap}',
  'budget.water': 'Agua: {use} / {cap}', 'budget.history': 'Dinero, últimos {n} meses',
  'budget.debt': 'En deuda: 1% de interés mensual, aprobación −10.',
  'budget.cut': 'Por debajo de {n}: policía, bomberos, escuelas, hospitales y parques quedan suspendidos.',
  'budget.waiting': 'Parcelas en espera: {road} sin carretera, {power} sin electricidad, {water} sin agua, {demand} con poca demanda, {value} con valor del suelo bajo',
  'save.save': 'Guardar', 'save.load': 'Cargar', 'save.saved': 'Ciudad guardada.', 'save.loaded': 'Ciudad cargada.',
  'save.none': 'No hay ciudad guardada.', 'save.failed': 'No se pudo guardar: el almacenamiento no está disponible.',
  'save.confirmLoad': '¿Cargar la ciudad guardada? Se perderá el progreso no guardado.',
  'save.confirmNew': '¿Empezar una ciudad nueva? La ciudad actual se perderá si no está guardada.',
  'share.title': 'Compartir', 'share.code': 'Código de ciudad', 'share.copyCode': 'Copiar código', 'share.copyLink': 'Copiar enlace',
  'share.import': 'Importar', 'share.paste': 'Pega aquí un código de ciudad o un enlace', 'share.copied': 'Copiado al portapapeles.',
  'share.copyFailed': 'No se pudo copiar: selecciona el texto y cópialo manualmente.',
  'share.invalid': 'Eso no es un código válido de Main City.',
  'share.loaded': 'Ciudad compartida cargada. No se guarda automáticamente hasta que hagas un cambio.',
  'share.note': 'Solo se comparte por código o enlace: no hay multijugador en vivo.',
  'help.controls': 'Controles',
  'help.mouse': 'Ratón: clic izquierdo o arrastrar usa la herramienta, arrastrar con el botón derecho o central mueve el mapa, la rueda hace zoom.',
  'help.touch': 'Táctil: toca para colocar, arrastra con la herramienta Mover para desplazarte, pinza para hacer zoom, dos dedos siempre mueven el mapa, pulsación larga para inspeccionar.',
  'help.keys': 'R carretera · Z cambiar zona · B demoler · I inspeccionar · Espacio pausa · 1/2/3 velocidad · Esc cancelar · O capa · H ayuda · WASD mover · flechas mueven el cursor · Intro construir · +/− zoom · Ctrl+S guardar',
  'help.howTo': 'Cómo crecer',
  'help.howToText': '1. Traza carreteras. 2. Zonifica parcelas junto a las carreteras. 3. Dales electricidad con una central dentro del alcance. 4. Añade un depósito de agua para edificios más altos. 5. Equilibra viviendas y empleos: vigila las barras RCI. 6. Parques y escuelas aumentan el valor del suelo.',
  'help.legend': 'Leyenda', 'help.legend.r': 'Residencial — verde', 'help.legend.c': 'Comercial — azul',
  'help.legend.i': 'Industrial — naranja',
  'help.legend.badges': 'Insignias: rayo = sin electricidad, gota = sin agua, señal = sin acceso por carretera',
  'help.blockers': 'Colores de la capa de bloqueos',
  'err.water': 'No se puede construir sobre el agua.', 'err.occupied': 'Ese lugar está ocupado.',
  'err.money': 'No hay suficiente dinero (límite {n}).', 'err.bounds': 'Fuera del mapa.', 'err.nothing': 'Nada que hacer aquí.',
  'err.save': 'Los datos guardados están dañados.', 'err.version': 'Creado con una versión más nueva del juego.',
  'err.storage': 'El almacenamiento no está disponible en este navegador.', 'err.unexpected': 'Algo salió mal.',
  'toast.welcome': '¡Bienvenido a {name}! Traza una carretera y zonifica a su lado.', 'toast.firstHouse': '¡Llegaron tus primeros habitantes!',
  'toast.fire': 'Un incendio destruyó un edificio en {x}, {y}.', 'toast.debt': 'La ciudad está en deuda: ahora se cobran intereses.',
  'toast.debtCleared': 'Fuera de deuda.', 'toast.servicesCut': 'Servicios suspendidos por falta de fondos.',
  'toast.servicesRestored': 'Servicios restablecidos.', 'toast.powerShort': 'Falta electricidad: construye otra central.',
  'toast.waterShort': 'Falta agua: construye otro depósito.',
  'skin.label': 'Estilo de mapa', 'skin.grassland': 'Pradera', 'skin.desert': 'Desierto', 'skin.snow': 'Nieve', 'skin.night': 'Noche',
  'lang.label': 'Idioma',
  'month.1': 'ene', 'month.2': 'feb', 'month.3': 'mar', 'month.4': 'abr', 'month.5': 'may', 'month.6': 'jun',
  'month.7': 'jul', 'month.8': 'ago', 'month.9': 'sep', 'month.10': 'oct', 'month.11': 'nov', 'month.12': 'dic',
  'date.fmt': '{d} de {m}, año {y}',
  'ui.yes': 'Sí', 'ui.no': 'No', 'ui.ok': 'Aceptar', 'ui.cancel': 'Cancelar',
  'a11y.canvas': 'Mapa de la ciudad. Elige una herramienta, mueve el cursor con las flechas y pulsa Intro para construir.',
  'a11y.toolbar': 'Herramientas de construcción', 'a11y.speed': 'Velocidad del juego', 'a11y.zoomIn': 'Acercar', 'a11y.zoomOut': 'Alejar',
  'a11y.center': 'Ajustar mapa', 'a11y.rci': 'Demanda {zone} {n} por ciento', 'a11y.toasts': 'Notificaciones', 'a11y.panels': 'Paneles',
};

const ru = {
  'app.title': 'Main City', 'app.tagline': 'Построй город сам — прямо в браузере.',
  'landing.new': 'Новый город', 'landing.continue': 'Продолжить', 'landing.openShared': 'Открыть чужой город',
  'landing.name': 'Название города', 'landing.continueMeta': '{name} · население {pop} · {date}',
  'landing.noSave': 'Сохранённого города пока нет', 'landing.saveDate': '{m}, год {y}',
  'hud.cash': 'Деньги', 'hud.pop': 'Население', 'hud.jobs': 'Работа', 'hud.approval': 'Одобрение', 'hud.date': 'Дата',
  'hud.demand': 'Спрос', 'hud.r': 'Ж', 'hud.c': 'К', 'hud.i': 'П',
  'speed.0': 'Пауза', 'speed.1': 'Обычная скорость', 'speed.2': 'Быстро', 'speed.3': 'Очень быстро',
  'tool.pan': 'Перемещение', 'tool.inspect': 'Осмотр', 'tool.road': 'Дорога', 'tool.zone_r': 'Жилая зона',
  'tool.zone_c': 'Коммерческая зона', 'tool.zone_i': 'Промышленная зона', 'tool.bulldoze': 'Снос',
  'tool.power': 'Электростанция', 'tool.water': 'Водонапорная башня', 'tool.park': 'Парк', 'tool.police': 'Полицейский участок',
  'tool.fire': 'Пожарная станция', 'tool.school': 'Школа', 'tool.hospital': 'Больница',
  'tool.cost': 'Стоимость: {n}', 'tool.upkeep': 'Содержание: {n}/мес.', 'tool.radius': 'Радиус: {n}', 'tool.key': 'Клавиша: {k}',
  'overlay.label': 'Слой', 'overlay.none': 'Нет', 'overlay.power': 'Электричество', 'overlay.water': 'Вода',
  'overlay.value': 'Стоимость земли', 'overlay.pollution': 'Загрязнение', 'overlay.block': 'Препятствия росту',
  'panel.inspector': 'Осмотр', 'panel.budget': 'Бюджет', 'panel.help': 'Справка', 'panel.save': 'Сохранение и обмен',
  'panel.close': 'Закрыть',
  'inspect.none': 'Выберите клетку, чтобы осмотреть её.', 'inspect.coords': 'Клетка {x}, {y}', 'inspect.grass': 'Трава',
  'inspect.tree': 'Деревья', 'inspect.water': 'Вода', 'inspect.road': 'Дорога', 'inspect.lot': 'Участок: {zone} (пустой)',
  'inspect.building': '{zone}, здание уровня {level}',
  'zone.r': 'Жилая', 'zone.c': 'Коммерческая', 'zone.i': 'Промышленная',
  'inspect.residents': 'Жителей: {n}', 'inspect.jobs': 'Рабочих мест: {n}', 'inspect.powered': 'Есть электричество',
  'inspect.unpowered': 'Нет электричества', 'inspect.watered': 'Есть вода', 'inspect.unwatered': 'Нет воды',
  'inspect.access': 'Есть дорога', 'inspect.noAccess': 'Нет дороги рядом', 'inspect.landValue': 'Стоимость земли: {n}',
  'inspect.pollution': 'Загрязнение: {n}', 'inspect.services': 'Службы: {list}', 'inspect.noServices': 'Службы: нет',
  'inspect.whyNot': 'Не растёт: {reason}', 'inspect.growing': 'Растёт',
  'inspect.service': '{name} — радиус {radius}, содержание {upkeep}/мес.',
  'block.road': 'нет дороги рядом', 'block.power': 'нет электричества', 'block.water': 'нет воды', 'block.demand': 'низкий спрос',
  'block.value': 'слишком низкая стоимость земли', 'block.pollution': 'слишком много загрязнения', 'block.full': 'полностью застроен',
  'hint.road': 'Проложите дорогу вплотную к этому участку.', 'hint.power': 'Поставьте электростанцию в пределах радиуса.',
  'hint.powerCapacity': 'Электростанции перегружены — постройте ещё одну.',
  'hint.water': 'Поставьте водонапорную башню в пределах радиуса (нужна выше 1 уровня).',
  'hint.waterCapacity': 'Водонапорные башни перегружены — постройте ещё одну.',
  'hint.demand.r': 'Жителям нужна работа — выделите коммерческую или промышленную зону.',
  'hint.demand.c': 'Магазинам нужны покупатели — выделите больше жилых зон.',
  'hint.demand.i': 'Промышленности нужны рабочие — выделите жилую зону или добавьте парки против загрязнения.',
  'hint.value': 'Парки, школы и больницы повышают стоимость земли.', 'hint.pollution': 'Отодвиньте промышленность или добавьте парки.',
  'hint.full': 'Этот участок достиг максимального уровня.',
  'budget.tax': 'Налог: {n}%', 'budget.lastMonth': 'Прошлый месяц', 'budget.income': 'Доход', 'budget.upkeep': 'Содержание',
  'budget.interest': 'Проценты', 'budget.net': 'Итого', 'budget.power': 'Электричество: {use} / {cap}',
  'budget.water': 'Вода: {use} / {cap}', 'budget.history': 'Деньги за последние {n} мес.',
  'budget.debt': 'Долг: 1% процентов в месяц, одобрение −10.',
  'budget.cut': 'Ниже {n}: полиция, пожарные, школы, больницы и парки приостановлены.',
  'budget.waiting': 'Участки в ожидании: {road} без дороги, {power} без электричества, {water} без воды, {demand} с низким спросом, {value} с низкой стоимостью земли',
  'save.save': 'Сохранить', 'save.load': 'Загрузить', 'save.saved': 'Город сохранён.', 'save.loaded': 'Город загружен.',
  'save.none': 'Нет сохранённого города.', 'save.failed': 'Не удалось сохранить — хранилище недоступно.',
  'save.confirmLoad': 'Загрузить сохранённый город? Несохранённый прогресс будет потерян.',
  'save.confirmNew': 'Начать новый город? Текущий город будет потерян, если он не сохранён.',
  'share.title': 'Поделиться', 'share.code': 'Код города', 'share.copyCode': 'Копировать код', 'share.copyLink': 'Копировать ссылку',
  'share.import': 'Импортировать', 'share.paste': 'Вставьте сюда код города или ссылку', 'share.copied': 'Скопировано в буфер обмена.',
  'share.copyFailed': 'Не удалось скопировать — выделите текст и скопируйте вручную.',
  'share.invalid': 'Это не похоже на код Main City.',
  'share.loaded': 'Чужой город загружен. Он не сохраняется автоматически, пока вы ничего не изменили.',
  'share.note': 'Обмен только по коду или ссылке — живого мультиплеера нет.',
  'help.controls': 'Управление',
  'help.mouse': 'Мышь: левая кнопка или перетаскивание применяет инструмент, правая или средняя перетаскивает карту, колесо меняет масштаб.',
  'help.touch': 'Сенсор: коснитесь, чтобы поставить; тяните инструментом «Перемещение», чтобы двигать карту; щипок меняет масштаб; два пальца всегда двигают карту; долгое нажатие — осмотр.',
  'help.keys': 'R дорога · Z смена зоны · B снос · I осмотр · Пробел пауза · 1/2/3 скорость · Esc отмена · O слой · H справка · WASD карта · стрелки двигают курсор · Enter строить · +/− масштаб · Ctrl+S сохранить',
  'help.howTo': 'Как расти',
  'help.howToText': '1. Проложите дороги. 2. Выделите участки у дорог. 3. Дайте им электричество от станции в радиусе. 4. Добавьте водонапорную башню для высоких зданий. 5. Балансируйте жильё и работу — следите за полосами спроса Ж/К/П. 6. Парки и школы повышают стоимость земли.',
  'help.legend': 'Легенда', 'help.legend.r': 'Жилая — зелёный', 'help.legend.c': 'Коммерческая — синий',
  'help.legend.i': 'Промышленная — оранжевый',
  'help.legend.badges': 'Значки: молния = нет электричества, капля = нет воды, знак = нет дороги',
  'help.blockers': 'Цвета слоя препятствий',
  'err.water': 'Нельзя строить на воде.', 'err.occupied': 'Это место занято.',
  'err.money': 'Недостаточно денег (предел {n}).', 'err.bounds': 'За пределами карты.', 'err.nothing': 'Здесь нечего делать.',
  'err.save': 'Данные сохранения повреждены.', 'err.version': 'Создано в более новой версии игры.',
  'err.storage': 'Хранилище недоступно в этом браузере.', 'err.unexpected': 'Что-то пошло не так.',
  'toast.welcome': 'Добро пожаловать в {name}! Проложите дорогу и выделите зону рядом.', 'toast.firstHouse': 'Первые жители заселились!',
  'toast.fire': 'Пожар уничтожил здание в {x}, {y}.', 'toast.debt': 'Город в долгах — начисляются проценты.',
  'toast.debtCleared': 'Долг погашен.', 'toast.servicesCut': 'Службы приостановлены из-за нехватки средств.',
  'toast.servicesRestored': 'Службы восстановлены.', 'toast.powerShort': 'Нехватка электричества — постройте ещё одну станцию.',
  'toast.waterShort': 'Нехватка воды — постройте ещё одну башню.',
  'skin.label': 'Стиль карты', 'skin.grassland': 'Луга', 'skin.desert': 'Пустыня', 'skin.snow': 'Снег', 'skin.night': 'Ночь',
  'lang.label': 'Язык',
  'month.1': 'янв', 'month.2': 'фев', 'month.3': 'мар', 'month.4': 'апр', 'month.5': 'май', 'month.6': 'июн',
  'month.7': 'июл', 'month.8': 'авг', 'month.9': 'сен', 'month.10': 'окт', 'month.11': 'ноя', 'month.12': 'дек',
  'date.fmt': '{d} {m}, год {y}',
  'ui.yes': 'Да', 'ui.no': 'Нет', 'ui.ok': 'ОК', 'ui.cancel': 'Отмена',
  'a11y.canvas': 'Карта города. Выберите инструмент, двигайте курсор стрелками и нажмите Enter, чтобы строить.',
  'a11y.toolbar': 'Инструменты', 'a11y.speed': 'Скорость игры', 'a11y.zoomIn': 'Приблизить', 'a11y.zoomOut': 'Отдалить',
  'a11y.center': 'Показать всю карту', 'a11y.rci': 'Спрос: {zone} — {n} %', 'a11y.toasts': 'Уведомления', 'a11y.panels': 'Панели',
};

// The hard-coded negative number below (budget.debt) sits in an LTR isolate (U+2066 … U+2069) so the
// minus renders before the digits in RTL text; money amounts arrive through {n} from formatMoney, which
// emits the same isolate.
const he = {
  'app.title': 'Main City', 'app.tagline': 'בנו עיר בעצמכם, ישירות בדפדפן.',
  'landing.new': 'עיר חדשה', 'landing.continue': 'המשך', 'landing.openShared': 'פתיחת עיר משותפת',
  'landing.name': 'שם העיר', 'landing.continueMeta': '{name} · {pop} תושבים · {date}',
  'landing.noSave': 'אין עדיין עיר שמורה', 'landing.saveDate': '{m}, שנה {y}',
  'hud.cash': 'כסף', 'hud.pop': 'אוכלוסייה', 'hud.jobs': 'משרות', 'hud.approval': 'שביעות רצון', 'hud.date': 'תאריך',
  'hud.demand': 'ביקוש', 'hud.r': 'מ', 'hud.c': 'ס', 'hud.i': 'ת',
  'speed.0': 'השהיה', 'speed.1': 'מהירות רגילה', 'speed.2': 'מהר', 'speed.3': 'הכי מהר',
  'tool.pan': 'גרירה', 'tool.inspect': 'בדיקה', 'tool.road': 'כביש', 'tool.zone_r': 'אזור מגורים',
  'tool.zone_c': 'אזור מסחרי', 'tool.zone_i': 'אזור תעשייה', 'tool.bulldoze': 'הריסה',
  'tool.power': 'תחנת כוח', 'tool.water': 'מגדל מים', 'tool.park': 'פארק', 'tool.police': 'תחנת משטרה',
  'tool.fire': 'תחנת כיבוי', 'tool.school': 'בית ספר', 'tool.hospital': 'בית חולים',
  'tool.cost': 'עלות: {n}', 'tool.upkeep': 'אחזקה: {n} לחודש', 'tool.radius': 'טווח: {n}', 'tool.key': 'מקש: {k}',
  'overlay.label': 'שכבה', 'overlay.none': 'ללא', 'overlay.power': 'חשמל', 'overlay.water': 'מים',
  'overlay.value': 'ערך קרקע', 'overlay.pollution': 'זיהום', 'overlay.block': 'חסמי צמיחה',
  'panel.inspector': 'בודק', 'panel.budget': 'תקציב', 'panel.help': 'עזרה', 'panel.save': 'שמירה ושיתוף',
  'panel.close': 'סגירה',
  'inspect.none': 'בחרו משבצת כדי לבדוק אותה.', 'inspect.coords': 'משבצת {x}, {y}', 'inspect.grass': 'דשא',
  'inspect.tree': 'עצים', 'inspect.water': 'מים', 'inspect.road': 'כביש', 'inspect.lot': 'מגרש {zone} (ריק)',
  'inspect.building': 'בניין {zone}, רמה {level}',
  'zone.r': 'מגורים', 'zone.c': 'מסחר', 'zone.i': 'תעשייה',
  'inspect.residents': 'תושבים: {n}', 'inspect.jobs': 'משרות: {n}', 'inspect.powered': 'מחובר לחשמל',
  'inspect.unpowered': 'אין חשמל', 'inspect.watered': 'יש אספקת מים', 'inspect.unwatered': 'אין מים',
  'inspect.access': 'גישה לכביש', 'inspect.noAccess': 'אין גישה לכביש', 'inspect.landValue': 'ערך קרקע: {n}',
  'inspect.pollution': 'זיהום: {n}', 'inspect.services': 'שירותים: {list}', 'inspect.noServices': 'שירותים: אין',
  'inspect.whyNot': 'לא צומח: {reason}', 'inspect.growing': 'צומח',
  'inspect.service': '{name} — טווח {radius}, אחזקה {upkeep} לחודש',
  'block.road': 'אין כביש סמוך', 'block.power': 'אין חשמל', 'block.water': 'אין מים', 'block.demand': 'ביקוש נמוך',
  'block.value': 'ערך קרקע נמוך מדי', 'block.pollution': 'יותר מדי זיהום', 'block.full': 'פיתוח מלא',
  'hint.road': 'בנו כביש שנוגע במגרש הזה.', 'hint.power': 'הציבו תחנת כוח בטווח.',
  'hint.powerCapacity': 'תחנות הכוח עמוסות מדי — בנו עוד אחת.',
  'hint.water': 'הציבו מגדל מים בטווח (נדרש מעל רמה 1).',
  'hint.waterCapacity': 'מגדלי המים עמוסים מדי — בנו עוד אחד.',
  'hint.demand.r': 'התושבים צריכים משרות — הקצו אזור מסחרי או תעשייתי.',
  'hint.demand.c': 'החנויות צריכות לקוחות — הקצו עוד אזורי מגורים.',
  'hint.demand.i': 'התעשייה צריכה עובדים — הקצו אזורי מגורים, או הוסיפו פארקים להפחתת הזיהום.',
  'hint.value': 'פארקים, בתי ספר ובתי חולים מעלים את ערך הקרקע.', 'hint.pollution': 'הרחיקו את התעשייה או הוסיפו פארקים.',
  'hint.full': 'המגרש הזה ברמה המקסימלית.',
  'budget.tax': 'שיעור מס: {n}%', 'budget.lastMonth': 'החודש שעבר', 'budget.income': 'הכנסות', 'budget.upkeep': 'אחזקה',
  'budget.interest': 'ריבית', 'budget.net': 'נטו', 'budget.power': 'חשמל: {use} / {cap}',
  'budget.water': 'מים: {use} / {cap}', 'budget.history': 'כסף, {n} החודשים האחרונים',
  'budget.debt': 'בחובות: ריבית של 1% לחודש, שביעות רצון ⁦−10⁩.',
  'budget.cut': 'מתחת ל־{n}: משטרה, כיבוי, בתי ספר, בתי חולים ופארקים מושבתים.',
  'budget.waiting': 'מגרשים ממתינים: {road} צריכים כביש, {power} צריכים חשמל, {water} צריכים מים, {demand} ביקוש נמוך, {value} ערך קרקע נמוך',
  'save.save': 'שמירה', 'save.load': 'טעינה', 'save.saved': 'העיר נשמרה.', 'save.loaded': 'העיר נטענה.',
  'save.none': 'אין עיר שמורה.', 'save.failed': 'לא ניתן לשמור — האחסון אינו זמין.',
  'save.confirmLoad': 'לטעון את העיר השמורה? התקדמות שלא נשמרה תאבד.',
  'save.confirmNew': 'להתחיל עיר חדשה? העיר הנוכחית תאבד אם לא נשמרה.',
  'share.title': 'שיתוף', 'share.code': 'קוד עיר', 'share.copyCode': 'העתקת קוד', 'share.copyLink': 'העתקת קישור',
  'share.import': 'ייבוא', 'share.paste': 'הדביקו כאן קוד עיר או קישור', 'share.copied': 'הועתק ללוח.',
  'share.copyFailed': 'ההעתקה נכשלה — סמנו את הטקסט והעתיקו ידנית.',
  'share.invalid': 'זה אינו קוד Main City תקין.',
  'share.loaded': 'העיר המשותפת נטענה. היא לא תישמר אוטומטית עד שתבצעו שינוי.',
  'share.note': 'השיתוף הוא באמצעות קוד עיר או קישור בלבד — אין משחק רב־משתתפים חי.',
  'help.controls': 'שליטה',
  'help.mouse': 'עכבר: לחיצה שמאלית או גרירה משתמשת בכלי, גרירה ימנית או אמצעית מזיזה את המפה, הגלגלת משנה את הזום.',
  'help.touch': 'מגע: הקישו להנחה, גררו עם כלי הגרירה כדי לנוע, צבטו לזום, שתי אצבעות תמיד מזיזות את המפה, לחיצה ארוכה לבדיקה.',
  'help.keys': 'R כביש · Z החלפת אזורים · B הריסה · I בדיקה · רווח השהיה · 1/2/3 מהירות · Esc ביטול · O שכבה · H עזרה · WASD תנועה · חצים מזיזים את הסמן · Enter בנייה · +/− זום · Ctrl+S שמירה',
  'help.howTo': 'איך לצמוח',
  'help.howToText': '1. ציירו כבישים. 2. הקצו מגרשים שנוגעים בכבישים. 3. חברו אותם לחשמל עם תחנת כוח בטווח. 4. הוסיפו מגדל מים לבניינים גבוהים יותר. 5. אזנו בין בתים למשרות — עקבו אחרי פסי הביקוש מ/ס/ת. 6. פארקים ובתי ספר מעלים את ערך הקרקע.',
  'help.legend': 'מקרא', 'help.legend.r': 'מגורים — ירוק', 'help.legend.c': 'מסחר — כחול',
  'help.legend.i': 'תעשייה — כתום',
  'help.legend.badges': 'סמלים: ברק = אין חשמל, טיפה = אין מים, תמרור = אין גישה לכביש',
  'help.blockers': 'צבעי שכבת החסמים',
  'err.water': 'אי אפשר לבנות על מים.', 'err.occupied': 'המקום הזה תפוס.',
  'err.money': 'אין מספיק כסף (מגבלה {n}).', 'err.bounds': 'מחוץ למפה.', 'err.nothing': 'אין מה לעשות כאן.',
  'err.save': 'נתוני השמירה פגומים.', 'err.version': 'נוצר בגרסה חדשה יותר של המשחק.',
  'err.storage': 'האחסון אינו זמין בדפדפן הזה.', 'err.unexpected': 'משהו השתבש.',
  'toast.welcome': 'ברוכים הבאים ל{name}! ציירו כביש והקצו אזור לידו.', 'toast.firstHouse': 'התושבים הראשונים נכנסו לגור!',
  'toast.fire': 'שריפה הרסה בניין ב־{x}, {y}.', 'toast.debt': 'העיר בחובות — נגבית כעת ריבית.',
  'toast.debtCleared': 'יצאנו מהחובות.', 'toast.servicesCut': 'השירותים הושבתו מחוסר תקציב.',
  'toast.servicesRestored': 'השירותים חזרו לפעול.', 'toast.powerShort': 'מחסור בחשמל — בנו תחנת כוח נוספת.',
  'toast.waterShort': 'מחסור במים — בנו מגדל מים נוסף.',
  'skin.label': 'סגנון מפה', 'skin.grassland': 'ערבה', 'skin.desert': 'מדבר', 'skin.snow': 'שלג', 'skin.night': 'לילה',
  'lang.label': 'שפה',
  'month.1': 'ינו׳', 'month.2': 'פבר׳', 'month.3': 'מרץ', 'month.4': 'אפר׳', 'month.5': 'מאי', 'month.6': 'יוני',
  'month.7': 'יולי', 'month.8': 'אוג׳', 'month.9': 'ספט׳', 'month.10': 'אוק׳', 'month.11': 'נוב׳', 'month.12': 'דצמ׳',
  'date.fmt': '{d} ב{m}, שנה {y}',
  'ui.yes': 'כן', 'ui.no': 'לא', 'ui.ok': 'אישור', 'ui.cancel': 'ביטול',
  'a11y.canvas': 'מפת העיר. בחרו כלי, הזיזו את הסמן עם מקשי החצים ולחצו Enter כדי לבנות.',
  'a11y.toolbar': 'כלי בנייה', 'a11y.speed': 'מהירות המשחק', 'a11y.zoomIn': 'התקרבות', 'a11y.zoomOut': 'התרחקות',
  'a11y.center': 'התאמת המפה', 'a11y.rci': 'ביקוש {zone} {n} אחוז', 'a11y.toasts': 'התראות', 'a11y.panels': 'חלוניות',
};

const DICT = Object.freeze({ en, es, ru, he });
const DEFAULT_LANG = 'en';

let current = DEFAULT_LANG;
/** Cached Intl.NumberFormat per language. */
const formatters = new Map();

/** The language id if it is one we ship, else null. */
function known(id) {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(DICT, id) ? id : null;
}

/** Lower-cased primary subtag of a BCP-47 tag ('pt-BR' → 'pt'); null for non-strings. */
function primary(tag) {
  return typeof tag === 'string' && tag ? tag.trim().toLowerCase().split(/[-_]/)[0] : null;
}

/**
 * Picks the UI language: `?lang=xx` in `search`, then the stored setting, then the
 * browser language's prefix, then English. Unknown ids fall through to the next source.
 * @param {string} search  `location.search`
 * @param {string|null} stored  Settings.lang
 * @param {string} navLang  `navigator.language`
 * @returns {string}
 */
export function detectLang(search, stored, navLang) {
  // URLSearchParams never throws on malformed percent-escapes (unlike decodeURIComponent).
  const fromQuery = primary(new URLSearchParams(search || '').get('lang'));
  return known(fromQuery) || known(stored) || known(primary(navLang)) || DEFAULT_LANG;
}

/**
 * Switches the current language synchronously and mirrors it to <html lang dir>.
 * Unknown ids select English.
 * @param {string} id
 */
export function setLang(id) {
  current = known(id) || DEFAULT_LANG;
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.lang = current;
    document.documentElement.dir = isRTL() ? 'rtl' : 'ltr';
  }
}

/** @returns {string} current language id */
export function getLang() { return current; }

/** @returns {boolean} true when the current language is written right-to-left */
export function isRTL() {
  const lang = LANGS.find((l) => l.id === current);
  return !!lang && lang.dir === 'rtl';
}

/**
 * Translates `key`, interpolating `{name}` placeholders from `params`.
 * Falls back current → English → the key itself; unknown placeholders are left as-is.
 * @param {string} key
 * @param {Record<string, unknown>} [params]
 * @returns {string}
 */
export function t(key, params) {
  const table = DICT[current];
  const s = (table && table[key]) ?? en[key] ?? String(key);
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (match, name) => {
    const v = params[name];
    return v === undefined || v === null ? match : String(v);
  });
}

/**
 * Applies translations to static DOM: `[data-i18n]` → textContent, `[data-i18n-aria]` → aria-label,
 * `[data-i18n-title]` → title, `[data-i18n-placeholder]` → placeholder.
 * @param {ParentNode} root
 */
export function applyDom(root) {
  if (!root || typeof root.querySelectorAll !== 'function') return;
  const apply = (attr, set) => {
    for (const el of root.querySelectorAll(`[${attr}]`)) set(el, t(el.getAttribute(attr)));
  };
  apply('data-i18n', (el, s) => { el.textContent = s; });
  apply('data-i18n-aria', (el, s) => el.setAttribute('aria-label', s));
  apply('data-i18n-title', (el, s) => el.setAttribute('title', s));
  apply('data-i18n-placeholder', (el, s) => el.setAttribute('placeholder', s));
}

function numberFormat() {
  let f = formatters.get(current);
  if (!f) {
    f = new Intl.NumberFormat(current, { maximumFractionDigits: 0 });
    formatters.set(current, f);
  }
  return f;
}

/** Rounds to an integer; anything non-finite (NaN, undefined) becomes 0. */
function safeInt(n) {
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/**
 * '$1,234' with locale grouping; negatives as '−$1,234' (U+2212 minus). A negative amount is
 * wrapped in an LTR isolate (U+2066 … U+2069) so the minus stays in front of the amount inside
 * RTL text (otherwise the bidi algorithm pushes a leading sign to the trailing side).
 * @param {number} n
 * @returns {string}
 */
export function formatMoney(n) {
  const v = safeInt(n);
  const s = `$${numberFormat().format(Math.abs(v))}`;
  return v < 0 ? `⁦−${s}⁩` : s;
}

/**
 * Locale-grouped integer; non-finite input renders as 0.
 * @param {number} n
 * @returns {string}
 */
export function formatInt(n) {
  return numberFormat().format(safeInt(n));
}

/**
 * Short month name for 1..12 (clamped so an out-of-range month never shows a raw key).
 * @param {number} m
 * @returns {string}
 */
export function monthName(m) {
  const i = Math.min(12, Math.max(1, safeInt(m) || 1));
  return t(`month.${i}`);
}

/**
 * Formats a game clock as e.g. "Jan 1, year 1" in the current language.
 * @param {{ day:number, month:number, year:number }} clock
 * @returns {string}
 */
export function formatDate(clock) {
  const c = clock || {};
  return t('date.fmt', { d: safeInt(c.day) || 1, m: monthName(c.month), y: safeInt(c.year) || 1 });
}
