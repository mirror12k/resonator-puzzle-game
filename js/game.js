

// wait for document to load
window.addEventListener('load', () => {
	// settings
	var version = 'v1.0';

	// get our canvas
	var canvas = document.querySelector('#game_canvas');
	// insert our version string into the document
	document.querySelector('#version').innerText = version;
	document.head.querySelector('#title').innerText = document.head.querySelector('#title').innerText.replace("{ver}", version);

	// start loading assets
	SpriteLoad.load_all({
		images: {
			ui_white: 'assets/img/ui_white.png',
			wolf_tileset: 'assets/img/wolf_tileset.png',
		},
		levels: {
			level_map: 'lvls/level_map.ldtk',
		},
	}).then(loaded => {
		// when we're done loading, prep the game for our specs
		Game.singleton.background_color = '#000';
		Game.render_distance = 100;
		Game.render_fade_distance = 90;

		// slice tilesheets
		SpriteLoad.slice_tilesheet(Game.assets.images.wolf_tileset, 10, 10);

		// run the game
		Game.singleton.run(canvas, 60);

		// Game.add(new Mob(Game.assets.images.wolf_tileset.subimg(13,8), vec(50,50), vec(100,100)));
		// Game.add(new Mob(Game.assets.images.wolf_tileset.subimg(16,6), vec(100,100), vec(20,20)));

		// Game.add_service('cliffs_canvas', new CanvasController());
		// Game.add_service('enemy_building_canvas', new CanvasController());
		// Game.add_service('enemy_canvas', new CanvasController(vec(-10,0)));
		// Game.add_service('turret_canvas', new CanvasController());
		// Game.add_service('laser_canvas', new CanvasController());
		// Game.add_service('bullet_canvas', new CanvasController(vec(100,0)));
		// Game.add_service('bullet_canvas_upward', new CanvasController(vec(0,-100)));
		// Game.add_service('bullet_canvas_downward', new CanvasController(vec(0,100)));
		// Game.add_service('bullet_canvas_backward', new CanvasController(vec(-100,0)));
		// Game.add_service('frag_round_canvas', new CanvasController(vec(200,0)));
		// Game.singleton.services.turret_canvas.z_index = 9;
		// Game.singleton.services.enemy_building_canvas.z_index = 9;
		// Game.singleton.services.enemy_canvas.z_index = 10;
		// Game.singleton.services.bullet_canvas.z_index = 11;
		// Game.singleton.services.bullet_canvas_upward.z_index = 11;
		// Game.singleton.services.bullet_canvas_downward.z_index = 11;
		// Game.singleton.services.bullet_canvas_backward.z_index = 11;
		// Game.singleton.services.laser_canvas.z_index = 12;
		// Game.singleton.services.laser_canvas.gradually_erase = true;
		// Game.singleton.services.frag_round_canvas.z_index = 13;

		Game.camera = new PlayerFollowCamera(canvas.width, canvas.height);

		Game.main_text = Game.add_service('main_text', new TextEntity(vec(canvas.width / 2, canvas.height-30), 30));
		Game.main_text.text = "";
		Game.main_text.font_family = "equipmentpro";
		Game.main_text.post_message = (text, delay) => {
			delay = delay || 5;
			Game.main_text.text = text;
			Game.main_text.coro?.cancel();
			Game.main_text.coro = Game.after(delay, () => {
				Game.main_text.text = "";
			});
		};

		LevelController.world_data = Game.assets.levels.level_map;
		LevelController.load_world();
		LevelController.load_player_level();

		// Game.singleton.services.puzzle_grid.add(new PlayerEntity(vec(50,90)));
		// Game.singleton.services.puzzle_grid.add(new WallEntity(vec(110,90)));
		// Game.singleton.services.puzzle_grid.add(new BoulderEntity(vec(70,110)));
		// Game.singleton.services.puzzle_grid.add(new DemonEntity(vec(110,130)));
		// Game.singleton.services.puzzle_grid.add(new WallEntity(vec(150,130)));
		// Game.singleton.services.puzzle_grid.add(new WallEntity(vec(130,190)));
		// Game.singleton.services.puzzle_grid.add(new TeleporterEntity(vec(90,170), vec(110,210)));
		// Game.add(new PlayerEntity(vec(50,100)));
		// Game.singleton.services.enemy_canvas.add(new GraveEnemy(vec(600,100)));
		// Game.singleton.services.enemy_canvas.add(new GraveEnemy(vec(600,120)));
		// Game.singleton.services.enemy_canvas.add(new GraveEnemy(vec(600,140)));

		// Game.singleton.services.cliffs_canvas.add(new CliffPusher(vec(500,700-30), vec(0,-1)));
		// Game.singleton.services.cliffs_canvas.add(new CliffPusher(vec(500-30,700-60), vec(0,-1)));
		// Game.singleton.services.cliffs_canvas.add(new CliffPusher(vec(500-80,700-90), vec(0,-1)));
		// Game.singleton.services.cliffs_canvas.add(new CliffPusher(vec(500-110,700-120), vec(0,-1)));

		// Game.singleton.services.cliffs_canvas.add(new CliffPusher(vec(500,30), vec(0,1)));
		// Game.singleton.services.cliffs_canvas.add(new CliffPusher(vec(500-30,60), vec(0,1)));
		// Game.singleton.services.cliffs_canvas.add(new CliffPusher(vec(500,80), vec(0,1)));
		// Game.singleton.services.cliffs_canvas.add(new CliffPusher(vec(500-30,110), vec(0,1)));

		// Game.singleton.services.cliffs_canvas.add(new CliffPusher(vec(500,350-30), vec(0,-1)));
		// Game.singleton.services.cliffs_canvas.add(new CliffPusher(vec(500-10,350+30), vec(0,1)));

		// Game.singleton.services.level_controller.start_level();



	}).catch(e => {
		// error handler during loading
		console.log("something went wrong in loading :/", e);

		// draw error on screen
		var ctx = canvas.getContext('2d');
		ctx.fillStyle = "#f00";
		ctx.fillText("" + `${e.type}: ${e.message}: ${e.stack}\n`, 50, 50);
	});
});
