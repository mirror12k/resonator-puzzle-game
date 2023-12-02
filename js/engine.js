
/**
 * primary game singleton
 * handles top-level entity managing
 */
class Game {
	static assets = {};
	static singleton = new Game();
	static deltatime = 0;
	static timescale = 1;

	static camera = undefined;

	constructor() {
		this.entities = [];
		this.services = {};

		this.coroutines = [];
		this.framewise_coroutines = [];

		this.background_color = '#000';
	}

	// entry point to the game loop
	run(canvas, fps) {
		this.canvas = canvas;
		this.last_timestamp = new Date().getTime();
		this.ctx = this.canvas.getContext('2d');
		setInterval(this.step_game_frame.bind(this, this.ctx), 1000 / fps);

		this.paint_canvas = document.createElement('canvas');
		this.paint_canvas.width = this.canvas.width / 5;
		this.paint_canvas.height = this.canvas.height / 5;
		this.paint_canvas_ctx = this.paint_canvas.getContext('2d');

	}
	// single step of the game loop
	step_game_frame(ctx) {
		if (document.hasFocus()) {
			// calculate deltatime
			var time = new Date().getTime();
			Game.deltatime = Game.timescale * Math.min((time - this.last_timestamp) / 1000, 1 / 10);
			this.last_timestamp = time;

			// update the game entites
			this.update();
			
			if (DrawDebug.toggles.toggle_3) {
				DrawDebug.toggles.toggle_2 = true;
				// draw the game entites
				this.draw(this.paint_canvas, this.paint_canvas_ctx);
				
				DrawDebug.toggles.toggle_2 = false;
			}
			// draw the game entites
			this.draw(this.canvas, ctx);
		}
	}
	update() {
		try {
			// update all coroutines
			this.update_coroutines();

			// update all entities
			for (var ent of this.entities.filter(e => e.active).sort(function (a, b) { return a.u_index - b.u_index; }))
				ent.update();

			// update all game systems
			for (var key of Object.keys(this.services))
				this.services[key].update();

			Game.camera?.update();

			// step input state
			Input.singleton.update();

		} catch (e) {
			console.error(e);
		}
	}
	draw(canvas, ctx) {
		try {
			
			ctx.imageSmoothingEnabled = false;
			ctx.globalCompositeOperation = 'source-over';
			ctx.globalAlpha = 1;
			if (DrawDebug.toggles.toggle_2)
				ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
			else
				ctx.fillStyle = this.background_color;
				ctx.fillRect(0, 0, canvas.width, canvas.height);

			// prep a list of entites to draw
			var entities_3d_to_draw = this.entities.filter(e => e.active && e instanceof Screen3DEntity);
			// prep a list of 3d faces to draw
			var faces_3d_to_draw = entities_3d_to_draw.flatMap(e => e.get_3d_faces());
			faces_3d_to_draw.forEach(face => face.delta = Game.camera.world_to_camera_offset(face.p));
			faces_3d_to_draw.forEach(face => face.sort_order = Math.max(...face.ps.map(p => Game.camera.world_to_camera_offset(p).y)));
			// faces_3d_to_draw.sort(function (a, b) { return b.delta.y - a.delta.y; });

			// calculate entity distances
			entities_3d_to_draw.forEach(ent => ent.delta = Game.camera.world_to_camera_offset(ent.r.p));
			entities_3d_to_draw.forEach(ent => ent.sort_order = ent.delta.y);
			// entities_3d_to_draw.forEach(ent => ent.delta = ent.r.p.clone().sub(Game.camera.r.p).rotate(-Game.camera.angle));
			// filter entities that are behind us or too far away in the fog
			// entities_3d_to_draw = entities_3d_to_draw.filter(ent => ent.delta.y > 0 && ent.delta.y < Game.render_distance);
			// sort our draw entities
			// entities_3d_to_draw.sort(function (a, b) { return b.delta.y - a.delta.y; });

			// var boxes = this.entities.filter(e => e.active && e instanceof WalledBox);
			// boxes.forEach(box => box.delta = Game.camera.world_to_camera_offset(box.r.p));
			// boxes.sort(function (a, b) { return b.delta.y - a.delta.y; });

			var all_3d_to_draw = [].concat(faces_3d_to_draw, entities_3d_to_draw);
			all_3d_to_draw = all_3d_to_draw.filter(e => e.delta.y > 0 && e.delta.y < Game.render_distance);
			all_3d_to_draw.sort(function (a, b) { return b.sort_order - a.sort_order; });

			// get our systems and draw them if necessary
			var game_systems_to_draw = Object.values(this.services);
			game_systems_to_draw.sort(function (a, b) { return a.z_index - b.z_index; });

			// prep a list of entites to draw
			var entities_to_draw = this.entities.filter(e => e.active && !(e instanceof Screen3DEntity));
			// sort our draw entities
			entities_to_draw.sort(function (a, b) { return a.z_index - b.z_index; });
			game_systems_to_draw.sort(function (a, b) { return a.z_index - b.z_index; });




			ctx.save();

			// only draw systems below z_index 0
			for (var system of game_systems_to_draw.filter(s => s.z_index < 0))
				system.draw(ctx);

			ctx.save();
			// apply camera transformations if we have a camera
			// game systems are drawn without camera transforms
			if (Game.camera) {
				ctx.translate(canvas.width / 2, canvas.height / 2);
				// ctx.scale(canvas.width, canvas.height);
				// ctx.rotate(-Game.camera.angle);
				ctx.scale(Game.camera.scale.x, Game.camera.scale.y);
				ctx.translate(-Game.camera.r.p.x, -Game.camera.r.p.y);
			}

			ctx.translate(-0.5, -0.5);
			// draw all underlayed entites
			ctx.save();
			for (var ent of entities_to_draw.filter(s => s.z_index < 0))
				ent.draw(ctx);
			ctx.restore();
			ctx.save();
			ctx.translate(0.5, 0.5);
			// draw all 3d entites
			for (var ent of all_3d_to_draw)
				ent.draw(ctx);
			// for (var ent of entities_3d_to_draw)
			// 	ent.draw(ctx);
			// for (var face of faces_3d_to_draw)
			// 	face.draw(face, ctx);
			ctx.restore();
			ctx.save();
			ctx.translate(-0.5, -0.5);
			// draw all overlayed entites
			for (var ent of entities_to_draw.filter(s => s.z_index >= 0))
				ent.draw(ctx);
			ctx.restore();

			ctx.restore();

			if (!DrawDebug.toggles.toggle_2 && DrawDebug.toggles.toggle_3) {
				ctx.save();
				ctx.globalCompositeOperation = 'multiply';
				ctx.drawImage(this.paint_canvas, 0,0, this.canvas.width, this.canvas.height);
				ctx.restore();
			}

			// draw all systems which belong above z_index 0
			for (var system of game_systems_to_draw) {
				if (system.z_index >= 0) {
					// console.log("system late draw:", system);
					system.draw(ctx);
				}
			}

			ctx.restore();

		} catch (e) {
			console.error(e);
		}
	}
	update_coroutines() {
		var to_remove = [];
		for (var coro of [...this.coroutines]) {
			if (coro.until_condition) {
				coro.timer += Game.deltatime;
				if (coro.until_condition()) {
					if (coro.callback)
						coro.callback(coro.timer);
					to_remove.push(coro);
				} else {
					if (coro.frame_callback)
						coro.frame_callback(coro.timer);
				}
			} else {
				if ((coro.timer -= Game.deltatime) <= 0) {
					if (coro.interval !== undefined) {
						coro.timer += coro.interval;
						if (coro.times) {
							if (--coro.times <= 0)
								to_remove.push(coro);
						}
					} else {
						to_remove.push(coro);
					}
					// console.log("coro:", coro);
					if (coro.callback)
						coro.callback();
				} else if (coro.frame_callback) {
					coro.frame_callback(coro.timer);
				}
			}
		}
		this.coroutines = this.coroutines.filter(coro => !to_remove.includes(coro));
		for (var coro of to_remove)
			while (coro?.chain) {
				if (coro.chain.then_callback) {
					var ret = coro.chain.then_callback();
					coro = ret instanceof ChainableCoroutine ? ret : coro.chain;
				} else {
					this.coroutines.push(coro.chain);
					coro = undefined;
				}
			}
	}

	// adds a single entity or a list of entities to the game
	static add(ent) { return Game.singleton.add(ent); }
	add(ent) {
		if (ent instanceof Array) {
			for (var e of ent) {
				e.parent = this;
				this.entities.push(e);
			}
		} else {
			ent.parent = this;
			this.entities.push(ent);
		}
		return ent;
	}
	// removes a single entity or a list of entities from the game
	static remove(ent) { Game.singleton.remove(ent); }
	remove(ent) {
		if (ent instanceof Array) {
			ent.forEach(e => e.on_remove());
			this.entities = this.entities.filter(e => !ent.includes(e));
		} else {
			ent.on_remove();
			var index = this.entities.indexOf(ent);
			if (index !== -1)
				this.entities.splice(index, 1);
		}
	}

	// coroutine functionality
	static after(delta, callback) {
		var coro = new ChainableCoroutine({
			timer: delta,
			callback: callback,
		});
		Game.singleton.coroutines.push(coro);
		return coro;
	}
	static every(delta, times, callback) {
		if (callback) {
			var coro = new ChainableCoroutine({
				interval: delta,
				times: times,
				timer: delta,
				callback: callback,
			});
			Game.singleton.coroutines.push(coro);
			return coro;
		} else {
			callback = times;
			var coro = new ChainableCoroutine({
				interval: delta,
				timer: delta,
				callback: callback,
			});
			Game.singleton.coroutines.push(coro);
			return coro;
		}
	}
	static until(until_condition, frame_callback, callback) {
		var coro = new ChainableCoroutine({
			timer: 0,
			until_condition: until_condition,
			frame_callback: frame_callback,
			callback: callback,
		});
		Game.singleton.coroutines.push(coro);
		return coro;
	}
	static transition(delta, callback, end_callback) {
		var coro = new ChainableCoroutine({
			timer: delta,
			frame_callback: t => callback(1 - Math.max(0, t / delta)),
			callback: end_callback,
		});
		Game.singleton.coroutines.push(coro);
		return coro;
	}

	// utility function
	static add_service(name, service) {
		Game.singleton.services[name] = service;
		return service;
	}
}

class ChainableCoroutine {
	constructor(props) {
		Object.assign(this, props);
	}
	then(callback) {
		this.chain = new ChainableCoroutine({
			then_callback: callback,
		});
		return this.chain;
	}
	then_after(delta, callback) {
		this.chain = () => Game.after(delta, callback);
		return this.chain;
	}
	then_every(delta, times, callback) {
		this.chain = callback
			? new ChainableCoroutine({
				interval: delta,
				times: times,
				timer: delta,
				callback: callback,
			})
			: new ChainableCoroutine({
				interval: delta,
				timer: delta,
				callback: times,
			});
		return this.chain;
	}
	then_until(until_condition, callback, end_callback) {
		this.chain = () => Game.until(until_condition, callback, end_callback);
		return this.chain;
	}
	then_transition(delta, callback, end_callback) {
		this.chain = () => new ChainableCoroutine({
			timer: delta,
			frame_callback: t => callback(1 - Math.max(0, t / delta)),
			callback: end_callback,
		});
		return this.chain;
	}

	cancel() {
		var index = Game.singleton.coroutines.indexOf(this);
		if (index !== -1)
			Game.singleton.coroutines.splice(index, 1);
	}
}


/**
 * primary input handler class
 * implements keyboard and mouse tracking
 */
class Input {
	static singleton = new Input();

	constructor() {
		this.previous_keystate = {};
		this.keystate = {};
		this.previous_mouse1_state = false;
		this.mouse1_state = false;

		Input.mouse_position = vec(0,0);
		Input.mouse_game_position = vec(0,0);

		window.addEventListener('load', () => {

			document.addEventListener('keydown', (function (e) {
				e = e || window.event;
				if (!this.keystate.ctrl)
					e.preventDefault();
				this.keystate[e.key.toLowerCase()] = true;
				this.keystate.shift = !!e.shiftKey;
				this.keystate.ctrl = !!e.ctrlKey;
				this.keystate.alt = !!e.altKey;
				// console.log('keydown: ', e.key.toLowerCase());
			}).bind(this));

			document.addEventListener('keyup', (function (e) {
				e = e || window.event;
				if (!this.keystate.ctrl)
					e.preventDefault();
				this.keystate[e.key.toLowerCase()] = false;
				this.keystate.shift = !!e.shiftKey;
				this.keystate.ctrl = !!e.ctrlKey;
				this.keystate.alt = !!e.altKey;
				// console.log('keyup: ', e.key.toLowerCase());
			}).bind(this));

			document.addEventListener('mousedown', e => {
				this.update_mouse_position(e);
				this.mouse1_state = true;
			});
			document.addEventListener('mouseup', e => {
				this.update_mouse_position(e);
				this.mouse1_state = false;
			});
			document.addEventListener('mousemove', e => {
				this.update_mouse_position(e);
			});
		});
	}

	update_mouse_position(e) {
		if (Game.singleton?.canvas) {
			var x = e.x - Game.singleton.canvas.getBoundingClientRect().left;
			var y = e.y - Game.singleton.canvas.getBoundingClientRect().top;
			Input.mouse_position = vec(x,y);
			Input.mouse_game_position = Game.camera ? Game.camera.translate_screen_to_world(Input.mouse_position) : Input.mouse_position;
		}
	}

	update() {
		// refresh key and mouse states
		this.previous_keystate = this.keystate;
		this.keystate = Object.assign({}, this.keystate);
		this.previous_mouse1_state = this.mouse1_state;
	}


	static is_mouse_pressed() { return !Input.singleton.previous_mouse1_state && Input.singleton.mouse1_state; };
	static is_mouse_down() { return Input.singleton.mouse1_state; };
	static is_mouse_released() { return Input.singleton.previous_mouse1_state && !Input.singleton.mouse1_state; };
	static is_key_pressed(k) { return Input.singleton.keystate[k] && !Input.singleton.previous_keystate[k]; };
	static is_key_down(k) { return Input.singleton.keystate[k]; };
	static is_key_released(k) { return !Input.singleton.keystate[k] && Input.singleton.previous_keystate[k]; };

}




/**
 * Utility class for loading sprites and other assets
 */
class SpriteLoad {
	// loads a single image from cache or url
	static load_image(url) {
		return new Promise((resolve, reject) => {
			var img = document.querySelector("img[data-url='" + url + "']");
			if (img)
				resolve(img);
			else
				return resolve(SpriteLoad.load_image_remote(url));
		});
	}
	// loads an image by url
	static load_image_remote(url) {
		return new Promise((resolve, reject) => {
			var image = new Image();
			image.addEventListener('load', () => resolve(image));
			image.addEventListener('error', e => reject(e));
			// image.setAttribute('crossorigin', 'anonymous');
			image.src = url + '?t=' + new Date().getTime();
			image.dataset.url = url;
		});
	}

	// // loads a json file by url
	// static load_levels_remote(url) {
	// 	url += '?t=' + new Date().getTime();
	// 	return fetch(url)
	// 		.then(res => res.json());
	// }

	// loads a json file from cache or url
	static load_json(url) {
		return new Promise((resolve, reject) => {
			var json_tag = document.querySelector("script[data-url='" + url + "']");
			if (json_tag)
				resolve(JSON.parse(json_tag.textContent));
			else
				return resolve(SpriteLoad.load_json_remote(url));
		});
	}

	// loads a json file by url
	static load_json_remote(url) {
		url += '?t=' + new Date().getTime();
		return fetch(url).then(res => res.text()).then(text => JSON.parse(text));
	}

	// loads a json file from cache or url
	static load_text(url) {
		return new Promise((resolve, reject) => {
			var json_tag = document.querySelector("script[data-url='" + url + "']");
			if (json_tag)
				resolve(JSON.parse(json_tag.textContent));
			else
				return resolve(SpriteLoad.load_text_remote(url));
		});
	}

	// loads a json file by url
	static load_text_remote(url) {
		url += '?t=' + new Date().getTime();
		return fetch(url).then(res => res.text());
	}


	// loads a map of assets { images: { key value pairs of images } }
	static load_all(assets) {
		return new Promise((resolve, reject) => {
			var images = assets.images;
			var levels = assets.levels;
			var text = assets.text;

			var loaded_assets = {
				images: {},
				levels: {},
				text: {},
			};
			var count_loaded = 0;
			var count_expected = 0;
			if (images)
				count_expected += Object.keys(images).length;
			if (levels)
				count_expected += Object.keys(levels).length;
			if (text)
				count_expected += Object.keys(text).length;

			if (images) {
				for (var key of Object.keys(images)) {
					let k = key;
					SpriteLoad.load_image(images[k]).then(img => {
						loaded_assets.images[k] = img;
						count_loaded++;
						if (count_loaded >= count_expected) {
							Game.assets = loaded_assets;
							resolve(loaded_assets);
						}
					}).catch(e => reject(e));
				}
			}

			if (levels) {
				for (var key of Object.keys(levels)) {
					let k = key;
					SpriteLoad.load_json(levels[k]).then(res_json => {
						loaded_assets.levels[k] = res_json;
						count_loaded++;
						if (count_loaded >= count_expected) {
							Game.assets = loaded_assets;
							resolve(loaded_assets);
						}
					}).catch(e => reject(e));
				}
			}

			if (text) {
				for (var key of Object.keys(text)) {
					let k = key;
					SpriteLoad.load_text(text[k]).then(res_text => {
						loaded_assets.text[k] = res_text;
						count_loaded++;
						if (count_loaded >= count_expected) {
							Game.assets = loaded_assets;
							resolve(loaded_assets);
						}
					}).catch(e => reject(e));
				}
			}
		});
	}

	// experimental feature for reloading images on-the-fly
	static enable_live_reload(assets) {
		setInterval(() => {
			if (document.hasFocus()) {
				for (var key of Object.keys(images)) {
					let k = key;
					SpriteLoad.load_image(images[k]).then(img => {
						var old_img = Game.assets.images[k];
						Game.assets.images[k] = img;

						if (old_img.subimg !== null)
							SpriteLoad.slice_tilesheet(img, old_img.subimg.sx, old_img.subimg.sy);

						Game.singleton.entities.filter(e => e instanceof ScreenEntity && e.spritesheet === old_img).forEach(e => {
							e.spritesheet = img;
						});
						Game.singleton.entities.filter(e => e instanceof ScreenEntity && e.spritesheet.tilesheet === old_img).forEach(e => {
							e.spritesheet = img.subimg(e.spritesheet.x, e.spritesheet.y);
						});
					});
				}
			}
		}, 1000);
	}

	// slice a sprite into a tilesheet with the given size x and y
	static slice_tilesheet(img, sx, sy) {
		var i = 0;
		for (var y = 0; y < img.height; y+=sy) {
			for (var x = 0; x < img.width; x+=sx) {
				var c = document.createElement('canvas');
				c.width = sx;
				c.height = sy;
				var ctx = c.getContext('2d');
				ctx.imageSmoothingEnabled = false;
				ctx.drawImage(img, -x,-y);

				c.x = x/sx;
				c.y = y/sy;
				c.tilesheet = img;
				img['i_' + (x / sx) + '_' + (y / sy)] = c;
				img['i_' + i++] = c;
			}
		}

		img.subimg = (x,y) => {
			return img['i_' + x + '_' + y];
		};
		img.subimg_index = i => {
			return img['i_' + i];
		};
		img.subimg.sx = sx;
		img.subimg.sy = sy;
	}

	static render_img_color(img, color) {
		var c = document.createElement('canvas');
		c.width = img.width;
		c.height = img.height;
		var ctx = c.getContext('2d');
		ctx.imageSmoothingEnabled = false;
		ctx.drawImage(img, 0,0);
		ctx.globalCompositeOperation = 'multiply';
		ctx.fillStyle = color;
		ctx.fillRect(0,0,c.width,c.height);
		ctx.globalCompositeOperation = 'destination-in';
		ctx.drawImage(img, 0,0);
		return c;
	}

	static combine_sprites(size, images) {
		var c = document.createElement('canvas');
		c.width = size.x;
		c.height = size.y;
		var ctx = c.getContext('2d');
		ctx.imageSmoothingEnabled = false;
		images.forEach(img => {
			ctx.drawImage(img.img, img.p.x,img.p.y);
		});
		return c;
	}
}






/**
 * base implementation of a game entity
 * implements parentage for child-entities
 */
class Entity {
	constructor() {
		this.sub_entities = [];
		this.active = true;
		this.z_index = 0;
		this.u_index = 0;
	}
	// basic implementation of update
	update() {
		this.sub_entities.filter(e => e.active).forEach(e => e.update());
	}
	// basic implementation of draw
	draw(ctx) {
		var entities_to_draw = this.sub_entities.filter(e => e.active);
		entities_to_draw.sort(function (a, b) { return a.z_index - b.z_index; });
		entities_to_draw.forEach(e => e.draw(ctx));
	}
	// adds a single entity or a list of entities to this entity
	add(ent) {
		if (ent instanceof Array) {
			for (var e of ent) {
				e.parent = this;
				this.sub_entities.push(e);
			}
		} else {
			ent.parent = this;
			this.sub_entities.push(ent);
		}
		return ent;
	}
	// removes a single entity or a list of entities from this entity
	remove(ent) {
		if (ent instanceof Array) {
			ent.forEach(e => e.on_remove());
			this.sub_entities = this.sub_entities.filter(e => !ent.includes(e));
		} else {
			ent.on_remove();
			var index = this.sub_entities.indexOf(ent);
			if (index !== -1)
				this.sub_entities.splice(index, 1);
		}
	}

	on_remove() {
		this.parent = undefined;
	}
}


class Rect {
	constructor(position, size) {
		this.p = position;
		this.s = size;
	}
	contains(p) {
		return Math.abs(p.x - this.p.x) < this.s.x / 2 && Math.abs(p.y - this.p.y) < this.s.y / 2;
	}
	intersects(r) {
		return !(this.p.x + this.s.x / 2 <= r.p.x - r.s.x / 2
				|| this.p.x - this.s.x / 2 >= r.p.x + r.s.x / 2
				|| this.p.y + this.s.y / 2 <= r.p.y - r.s.y / 2
				|| this.p.y - this.s.y / 2 >= r.p.y + r.s.y / 2);
	}
	maximum_noncolliding_delta(r, delta) {
		delta = delta.clone();
		if (delta.x > 0) {
			delta.x = Math.max(0, Math.min(delta.x, (r.p.x - r.s.x / 2) - (this.p.x + this.s.x / 2)));
		} else if (delta.x < 0) {
			delta.x = Math.min(0, Math.max(delta.x, (r.p.x + r.s.x / 2) - (this.p.x - this.s.x / 2)));
		}
		if (delta.y > 0) {
			delta.y = Math.max(0, Math.min(delta.y, (r.p.y - r.s.y / 2) - (this.p.y + this.s.y / 2)));
		} else if (delta.y < 0) {
			delta.y = Math.min(0, Math.max(delta.y, (r.p.y + r.s.y / 2) - (this.p.y - this.s.y / 2)));
		}

		return delta;
	}

	box_point(p) {
		if (p.x < this.p.x - this.s.x / 2)
			p.x = this.p.x - this.s.x / 2;
		if (p.x > this.p.x + this.s.x / 2)
			p.x = this.p.x + this.s.x / 2;
		if (p.y < this.p.y - this.s.y / 2)
			p.y = this.p.y - this.s.y / 2;
		if (p.y > this.p.y + this.s.y / 2)
			p.y = this.p.y + this.s.y / 2;
		return p;
	}
	clone() {
		return new Rect(this.p.clone(), this.s.clone());
	}
}

function rect(position, size) { return new Rect(position, size); }


class Prism extends Rect {
	contains(p) {
		return Math.abs(p.x - this.p.x) < this.s.x / 2
			&& Math.abs(p.y - this.p.y) < this.s.y / 2
			&& Math.abs(p.z - this.p.z) < this.s.z / 2;
	}
	will_intersects(r, d) {
		var old_p = this.p;
		this.p = this.p.clone().add(d);

		var status = !(this.p.x + this.s.x / 2 <= r.p.x - r.s.x / 2
				|| this.p.x - this.s.x / 2 >= r.p.x + r.s.x / 2
				|| this.p.y + this.s.y / 2 <= r.p.y - r.s.y / 2
				|| this.p.y - this.s.y / 2 >= r.p.y + r.s.y / 2
				|| this.p.z + this.s.z / 2 <= r.p.z - r.s.z / 2
				|| this.p.z - this.s.z / 2 >= r.p.z + r.s.z / 2);

		this.p = old_p;

		return status;
	}
	intersects(r) {
		return !(this.p.x + this.s.x / 2 <= r.p.x - r.s.x / 2
				|| this.p.x - this.s.x / 2 >= r.p.x + r.s.x / 2
				|| this.p.y + this.s.y / 2 <= r.p.y - r.s.y / 2
				|| this.p.y - this.s.y / 2 >= r.p.y + r.s.y / 2
				|| this.p.z + this.s.z / 2 <= r.p.z - r.s.z / 2
				|| this.p.z - this.s.z / 2 >= r.p.z + r.s.z / 2);
	}
	maximum_noncolliding_delta(r, delta) {
		delta = delta.clone();
		if (delta.x > 0) {
			delta.x = Math.max(0, Math.min(delta.x, (r.p.x - r.s.x / 2) - (this.p.x + this.s.x / 2)));
		} else if (delta.x < 0) {
			delta.x = Math.min(0, Math.max(delta.x, (r.p.x + r.s.x / 2) - (this.p.x - this.s.x / 2)));
		}
		if (delta.y > 0) {
			delta.y = Math.max(0, Math.min(delta.y, (r.p.y - r.s.y / 2) - (this.p.y + this.s.y / 2)));
		} else if (delta.y < 0) {
			delta.y = Math.min(0, Math.max(delta.y, (r.p.y + r.s.y / 2) - (this.p.y - this.s.y / 2)));
		}
		if (delta.z > 0) {
			delta.z = Math.max(0, Math.min(delta.z, (r.p.z - r.s.z / 2) - (this.p.z + this.s.z / 2)));
		} else if (delta.z < 0) {
			delta.z = Math.min(0, Math.max(delta.z, (r.p.z + r.s.z / 2) - (this.p.z - this.s.z / 2)));
		}

		return delta;
	}
	maximum_interior_noncolliding_delta(r, delta) {
		delta = delta.clone();
		if (delta.x > 0) {
			delta.x = Math.max(0, Math.min(delta.x, (this.p.x + this.s.x / 2) - (r.p.x + r.s.x / 2)));
		} else if (delta.x < 0) {
			delta.x = Math.min(0, Math.max(delta.x, (this.p.x - this.s.x / 2) - (r.p.x - r.s.x / 2)));
		}
		if (delta.y > 0) {
			delta.y = Math.max(0, Math.min(delta.y, (this.p.y + this.s.y / 2) - (r.p.y + r.s.y / 2)));
		} else if (delta.y < 0) {
			delta.y = Math.min(0, Math.max(delta.y, (this.p.y - this.s.y / 2) - (r.p.y - r.s.y / 2)));
		}
		if (delta.z > 0) {
			delta.z = Math.max(0, Math.min(delta.z, (this.p.z + this.s.z / 2) - (r.p.z + r.s.z / 2)));
		} else if (delta.z < 0) {
			delta.z = Math.min(0, Math.max(delta.z, (this.p.z - this.s.z / 2) - (r.p.z - r.s.z / 2)));
		}

		return delta;
	}

	box_point(p) {
		if (p.x < this.p.x - this.s.x / 2)
			p.x = this.p.x - this.s.x / 2;
		if (p.x > this.p.x + this.s.x / 2)
			p.x = this.p.x + this.s.x / 2;
		if (p.y < this.p.y - this.s.y / 2)
			p.y = this.p.y - this.s.y / 2;
		if (p.y > this.p.y + this.s.y / 2)
			p.y = this.p.y + this.s.y / 2;
		if (p.z < this.p.z - this.s.z / 2)
			p.z = this.p.z - this.s.z / 2;
		if (p.z > this.p.z + this.s.z / 2)
			p.z = this.p.z + this.s.z / 2;
		return p;
	}
	clone() {
		return new Prism(this.p.clone(), this.s.clone());
	}
}

function prism(position, size) { return new Prism(position, size); }

/**
 * base implementation of a sprite
 */
class ScreenEntity extends Entity {
	constructor(spritesheet, position, size, max_frame=1) {
		super();
		this.spritesheet = spritesheet;
		this.r = rect(position, size);
		this.angle = 0;


		this.alpha = 1;
		this.frame = 0;
		this.max_frame = max_frame;
	}
	draw(ctx) {
		ctx.save();

		ctx.globalAlpha = this.alpha;
		ctx.translate(this.r.p.x, this.r.p.y);
		ctx.rotate(this.angle);

		var entities_to_draw = this.sub_entities.filter(e => e.active);
		entities_to_draw.sort(function (a, b) { return a.z_index - b.z_index; });
		entities_to_draw.filter(e => e.z_index < this.z_index).forEach(e => e.draw(ctx));
		this.draw_self(ctx);
		entities_to_draw.filter(e => e.z_index >= this.z_index).forEach(e => e.draw(ctx));

		ctx.restore();
	}
	draw_self(ctx) {
		if (this.spritesheet)
			ctx.drawImage(this.spritesheet,
				this.frame * (this.spritesheet.width / this.max_frame), 0, this.spritesheet.width / this.max_frame, this.spritesheet.height,
				0 - this.r.s.x / 2, 0 - this.r.s.y / 2, this.r.s.x, this.r.s.y);
	}
}

/**
 * base implementation of a 3d sprite
 */
class Screen3DEntity extends ScreenEntity {
	constructor(spritesheet, position, size, max_frame=1) {
		super(spritesheet, position, size, max_frame=1);
		this.r = prism(position, size);
		this.collider_r = this.r;

		this.height = 1;
	}
	draw(ctx) {
		ctx.save();

		ctx.globalAlpha = this.alpha * Math.min(1, Math.max(0, (Game.render_distance - this.delta.y) / (Game.render_distance - Game.render_fade_distance)));
		// ctx.translate(Math.floor(this.r.p.x), Math.floor(this.r.p.y));
		var forward = vec(0,1);
		var delta = this.delta;
		// var screen_p = Game.camera.camera_to_screen_offset(this.delta);
		// var delta = this.r.p.clone().sub(Game.camera.r.p).rotate(-Game.camera.angle);
		if (forward.dot(delta) > 0) {
			// var scale = 1 / (1 + delta.y);
			// ctx.scale(1 / scale, 1 / scale);
			// ctx.translate(screen_translate.x, screen_translate.y);
			ctx.scale(1 / delta.y, 1 / delta.y);
			ctx.translate(delta.x, -delta.z);
			// ctx.scale(1 / delta.y, 1 / delta.y);
			// ctx.rotate(this.angle);

			// var entities_to_draw = this.sub_entities.filter(e => e.active);
			// entities_to_draw.sort(function (a, b) { return a.z_index - b.z_index; });
			// entities_to_draw.filter(e => e.z_index < this.z_index).forEach(e => e.draw(ctx));
			this.draw_self(ctx);
			// entities_to_draw.filter(e => e.z_index >= this.z_index).forEach(e => e.draw(ctx));
			
		}

		ctx.restore();
	}
	draw_self(ctx) {
		if (this.spritesheet)
			ctx.drawImage(this.spritesheet,
				this.frame * (this.spritesheet.width / this.max_frame), 0, this.spritesheet.width / this.max_frame, this.spritesheet.height,
				0 - this.r.s.x / 2, 0 - this.r.s.y / 2, this.r.s.x, this.r.s.y);
	}

	get_3d_faces() { return []; }
}

// const slice_spacing_factor = 1;
const slice_spacing_factor = 1.02;
/**
 * base implementation of a 3d sprite
 */
class AdvancedScreen3DEntity extends Screen3DEntity {
	constructor(spritesheet, position, size, max_frame=1) {
		super(spritesheet, position, size, max_frame=1);
	}
	draw(ctx) {
		ctx.save();

		ctx.globalAlpha = this.alpha * Math.min(1, Math.max(0, (Game.render_distance - this.delta.y) / (Game.render_distance - Game.render_fade_distance)));
		// ctx.translate(Math.floor(this.r.p.x), Math.floor(this.r.p.y));
		var forward = vec(0,1);



		var topface_v = vec(0,0,.5);
		var topface = this.r.p.clone().add(topface_v);
		// var topface_p = vec(0,.5).normalize()
		// 	// .multiplyScalar(slice_spacing_factor);
		// var topface_pp = vec(.5,0).normalize()
		// 	// .multiplyScalar(slice_spacing_factor);
		var rotated = Game.camera.angle % Math.PI > Math.PI * 0.25 && Game.camera.angle % Math.PI < Math.PI * 0.75;

		var topface_p = !rotated ? vec(0,.5).normalize() : vec(.5,0).normalize();
		var topface_pp = vec(topface_p.y, topface_p.x);

		// var down = topface.clone().add(vec(0,-.5));
		// var up = topface.clone().add(vec(0,.5));
		// var left = topface.clone().add(vec(-.5,0));
		// var right = topface.clone().add(vec(.5,0));

		var steps = 5;
		var top_slices = [];
		var increment = 1 / steps;
		for (var i = 0; i < 1; i += increment) {
			top_slices.push({
				offset_start: topface.clone().add(topface_p.clone().multiplyScalar(i-.5)),
				offset_end: topface.clone().add(topface_p.clone().multiplyScalar(i-.5+increment)),
				offset_left: topface.clone().add(topface_p.clone().multiplyScalar(i-.5+increment/2)).add(topface_pp.clone().multiplyScalar(.5)),
				offset_right: topface.clone().add(topface_p.clone().multiplyScalar(i-.5+increment/2)).add(topface_pp.clone().multiplyScalar(-.5)),
				sprite_coords: [topface_p.clone().multiplyScalar(i), topface_p.clone().multiplyScalar(i+increment).add(topface_pp)],
			})
		}

		// top_slices.forEach(s => {
		// 	DrawDebug.draw_point_at_world(s.offset_start, '#ff0');
		// 	DrawDebug.draw_point_at_world(s.offset_end, '#f0f');
		// 	DrawDebug.draw_point_at_world(s.offset_left, '#f00');
		// 	DrawDebug.draw_point_at_world(s.offset_right, '#0f0');
		// });
		top_slices.forEach(s => {
			ctx.save();
			var delta = Game.camera.world_to_camera_offset(
				vec(0,0)
				.add(s.offset_left)
				.add(s.offset_right)
				.add(s.offset_start)
				.add(s.offset_end)
				.multiplyScalar(0.25));
			// var delta = Game.camera.world_to_camera_offset(s.offset_start.clone().add(s.offset_end).multiplyScalar(0.5));
			if (forward.dot(delta) > 0) {
				// var scale = 1 / (1 + delta.y);
				var screen_up = Game.camera.world_to_screen_offset(s.offset_start);
				screen_up.z = 0;
				var screen_down = Game.camera.world_to_screen_offset(s.offset_end);
				screen_down.z = 0;
				var screen_left = Game.camera.world_to_screen_offset(s.offset_left);
				screen_left.z = 0;
				var screen_right = Game.camera.world_to_screen_offset(s.offset_right);
				screen_right.z = 0;
				// var screen_height = Math.abs(screen_down.y - screen_up.y);
				var screen_height = screen_down.distanceTo(screen_up);
				var screen_width = screen_left.distanceTo(screen_right);

				var angle = vec(1,0).angleTo(screen_left.clone().sub(screen_right)) * Math.sign(screen_left.y - screen_right.y);

				var scale = delta.y;
				ctx.scale(1/scale, 1 / scale);
				ctx.translate(delta.x, -delta.z);
				ctx.rotate(angle + (rotated ? Math.PI * 0.5 : 0));
				ctx.scale(rotated ? -screen_height * steps * scale : 1, !rotated ? -screen_height * steps * scale : 1);
				// ctx.scale(1, -screen_width * scale);
				// ctx.scale(screen_width * scale, screen_height * steps * scale);
				// if (DrawDebug.toggles.toggle_3)
					// ctx.transform(1, (screen_left.y - screen_right.y) * steps, (screen_up.x - screen_down.x) * steps,
					// 				1, 0, 0);


				// ctx.globalAlpha = 0.4;
				this.draw_self_slice(ctx, s.sprite_coords[0], s.sprite_coords[1]);
			}
			ctx.restore();
			// DrawDebug.draw_point_at_world(s.offset_start, '#ff0');
			// DrawDebug.draw_point_at_world(s.offset_end, '#f0f');
		});

		// var faces = [vec(0,-.5)];
		var faces = [vec(0,.5), vec(.5,0), vec(0,-.5), vec(-.5,0)];
		// var steps = 5;
		// var increment = 1 / steps;
		// var slices = [];
		// for (var i = 0; i < 1; i += increment) {

		var slices = faces.flatMap(face => {
			var face_p = vec(-face.y, face.x).normalize().multiplyScalar(slice_spacing_factor);

			var slices = [];
			for (var i = 0; i < 1; i += increment) {
				slices.push({
					offset_start: face.clone().add(face_p.clone().multiplyScalar(i-.5)),
					offset_end: face.clone().add(face_p.clone().multiplyScalar(i-.5+increment)),
					// offset_left: topface.clone().add(topface_p.clone().multiplyScalar(i-.5+increment/2)).add(topface_pp.clone().multiplyScalar(.5)),
					// offset_right: topface.clone().add(topface_p.clone().multiplyScalar(i-.5+increment/2)).add(topface_pp.clone().multiplyScalar(-.5)),
					sprite_coords: [vec(i,0), vec(i+increment,1)],
				});
			}
			return slices;
			// 2 -> 4 -> 5
			// 1 -> 0.5 -> 0.4
			// 2 / #
			// return [
			// 	{
			// 		offset_start: f.clone().add(perpendicular.clone().multiplyScalar(-.5)),
			// 		offset_end: f.clone().add(perpendicular.clone().multiplyScalar(-0.3)),
			// 		sprite_coords: [vec(0,0), vec(0.2, 1)],
			// 	},
			// 	{
			// 		offset_start: f.clone().add(perpendicular.clone().multiplyScalar(-.3)),
			// 		offset_end: f.clone().add(perpendicular.clone().multiplyScalar(-.1)),
			// 		sprite_coords: [vec(0.2,0), vec(0.4, 1)],
			// 	},
			// 	{
			// 		offset_start: f.clone().add(perpendicular.clone().multiplyScalar(-.1)),
			// 		offset_end: f.clone().add(perpendicular.clone().multiplyScalar(.1)),
			// 		sprite_coords: [vec(0.4,0), vec(0.6, 1)],
			// 	},
			// 	{
			// 		offset_start: f.clone().add(perpendicular.clone().multiplyScalar(.1)),
			// 		offset_end: f.clone().add(perpendicular.clone().multiplyScalar(.3)),
			// 		sprite_coords: [vec(0.6,0), vec(0.8, 1)],
			// 	},
			// 	{
			// 		offset_start: f.clone().add(perpendicular.clone().multiplyScalar(.3)),
			// 		offset_end: f.clone().add(perpendicular.clone().multiplyScalar(.5)),
			// 		sprite_coords: [vec(0.8,0), vec(1, 1)],
			// 	},
			// ];
		});
		slices.forEach(o => o.screen_offset_start = Game.camera.world_to_screen_offset(this.r.p.clone().add(o.offset_start)));
		slices.forEach(o => o.screen_offset_end = Game.camera.world_to_screen_offset(this.r.p.clone().add(o.offset_end)));
		slices.forEach(o => o.camera_offset = Game.camera.world_to_camera_offset(
			this.r.p.clone().add(o.offset_start.clone().add(o.offset_end).multiplyScalar(0.5))));
		// var deltas = faces.map(o => Game.camera.world_to_camera_offset(this.r.p.clone().add(o)));
		// faces.sort(function (a, b) { return b.y - a.y; });
		slices.sort(function (a, b) { return b.camera_offset.y - a.camera_offset.y; });
		// faces.forEach(delta => {
		slices.forEach(o => {
			var delta = o.camera_offset;
			// var delta = ;
			// var delta = this.r.p.clone().sub(Game.camera.r.p).rotate(-Game.camera.angle);

			// var screen_start = vec(o.camera_offset_start.x / o.camera_offset_start.y, -o.camera_offset_start.z / o.camera_offset_start.y);
			// var screen_end = vec(o.camera_offset_end.x / o.camera_offset_end.y, -o.camera_offset_end.z / o.camera_offset_end.y);
			var screen_width = o.screen_offset_end.x - o.screen_offset_start.x;
			// DrawDebug.draw_point_at_2d(screen_start, '#f80');
			// DrawDebug.draw_point_at_2d(screen_end, '#08f');
			// DrawDebug.draw_point_at_2d(vec(delta.x / delta.y,-delta.z / delta.y), '#ff8f00');

			ctx.save();
			if (forward.dot(delta) > 0 && screen_width > 0) {
				// var scale = 1 / (1 + delta.y);
				var scale = delta.y;
				ctx.scale(1 / scale, 1 / scale);
				ctx.translate(delta.x, -delta.z);
				ctx.scale(screen_width * steps * scale, 1);

				// ctx.globalAlpha = 0.4;
				this.draw_self_slice(ctx, o.sprite_coords[0], o.sprite_coords[1]);


				
				// DrawDebug.draw_point_at_2d(vec(0,0), '#ff8f00');
				// DrawDebug.draw_point_at_2d(vec(.1,0), '#8fff00');
				// DrawDebug.draw_point_at_2d(vec(-.1,0), '#08f');

			}
			ctx.restore();
		})
		ctx.restore();
	}
	draw_self_slice(ctx, start, end) {
		if (this.spritesheet) {
			var sizex = this.spritesheet.width / this.max_frame;
			var lengthx = end.x - start.x;
			var lengthy = end.y - start.y;
			ctx.drawImage(this.spritesheet,
				(this.frame + start.x) * sizex, this.spritesheet.height * start.y, sizex * lengthx, this.spritesheet.height * lengthy,
				0 - this.r.s.x / 2 * lengthx, 0 - this.r.s.y / 2 * lengthy, this.r.s.x * lengthx, this.r.s.y * lengthy);
		}
	}
}

class DrawDebug {
	static toggles = {};

	static draw_point_at_2d(p, fill='#ff0000', size=0.02) {
		var ctx = Game.singleton.ctx;

		ctx.save();
		ctx.translate(p.x, p.y);
		// ctx.rotate(this.angle);

		ctx.fillStyle = fill;
		ctx.fillRect(-size/2,-size/2, size, size);
		
		ctx.restore();
	}
	static draw_line_at_2d(p1, p2, fill='#ff0000', size=0.005) {
		var ctx = Game.singleton.ctx;

		ctx.save();
		ctx.translate(p1.x, p1.y);
		// ctx.rotate(this.angle);

		ctx.strokeStyle = fill;
		ctx.lineWidth = size;
		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.lineTo(p2.x - p1.x, p2.y - p1.y);
		ctx.stroke();
		
		ctx.restore();
	}
	static draw_point_at_screen(p, fill='#ff0000', size=0.02) { DrawDebug.draw_point_at_2d(p, fill, size); }
	static draw_point_at_world(p, fill='#ff0000', size=0.02) { DrawDebug.draw_point_at_2d(Game.camera.world_to_screen_offset(p), fill, size); }
	static draw_line_at_world(p1, p2, fill='#ff0000', size=0.005) { DrawDebug.draw_line_at_2d(Game.camera.world_to_screen_offset(p1), Game.camera.world_to_screen_offset(p2), fill, size); }
}


class TextEntity extends ScreenEntity {
	constructor(position, size=30, color='#ddd',  shadow_color='#222', text="") {
		super();
		this.text = text;
		this.p = position;
		this.size = size;
		this.color = color;
		this.shadow_color = shadow_color;
		this.font_family = "dogicabold";
	}
	draw(ctx) {
		ctx.save();
		ctx.translate(2, 2);
		ctx.translate(this.p.x, this.p.y);
		ctx.rotate(this.angle);
		ctx.font = this.size + "px " + this.font_family;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillStyle = this.shadow_color;

		var lines = this.text.split("\n");
		lines.forEach((l,i) => {
			ctx.fillText(l,0, (i - lines.length / 2 + 0.5) * this.size * 1.5);
		});
		ctx.restore();
		ctx.save();
		ctx.translate(this.p.x, this.p.y);
		ctx.rotate(this.angle);
		ctx.font = this.size + "px " + this.font_family;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillStyle = this.color;

		var lines = this.text.split("\n");
		lines.forEach((l,i) => {
			ctx.fillText(l,0, (i - lines.length / 2 + 0.5) * this.size * 1.5);
		});
		ctx.restore();
	}
}




class GameCamera {
	constructor(p) {
		// this.r = rect(vec(width / 2, height / 2), vec(width, height));
		this.r = rect(p, vec(1,1));
		this.scale = vec(1,1);
		this.anglex = 0;
		this.anglez = 0;
		this.isometrization = 0;
	}

	translate_screen_to_world(p) {
		// var offset = d2_point_offset(this.anglez, pxy.px - this.width / 2, pxy.py - this.height / 2);
		return p.clone().sub(this.r.p);
		// return this.p.clone().add(p.clone()) { px: this.p.x + offset.px / this.scalex, py: this.py + offset.py / this.scaley };
	}

	get forward() {
		return vec(0,1,0).applyEuler(new Euler(this.anglex, 0, this.anglez));
	}

	world_to_screen_offset(p) {
		return this.camera_to_screen_offset(this.world_to_camera_offset(p));
	}

	world_to_camera_offset(p) {
		return p.clone().sub(this.r.p).applyEuler(new Euler(-this.anglex, 0, -this.anglez));
	}

	rotate_to_world(p) {
		return p.applyEuler(new Euler(-this.anglex, 0, -this.anglez));
	}
	camera_to_screen_offset(p) {
		var f = Math.max(0.000001, Math.abs(p.y * (1 - this.isometrization) + this.isometrization));
		return vec(p.x / f, -p.z / f, p.y);
	}

	update() {}
}


