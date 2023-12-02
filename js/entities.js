
const rand_int = max => Math.floor(Math.random() * max);

const tile_size = 20;

// class InputController extends Entity {
// 	static singleton = Game.add_service('input_controller', new InputController());
// 	update() {
// 		var direction = vec.zero;
// 		if (Input.is_key_pressed('a'))
// 			direction = vec(-1,0);
// 		else if (Input.is_key_pressed('s'))
// 			direction = vec(0,1);
// 		else if (Input.is_key_pressed('d'))
// 			direction = vec(1,0);
// 		else if (Input.is_key_pressed('w'))
// 			direction = vec(0,-1);
// 		if (direction !== vec.zero)
// 			Game.singleton.services.puzzle_grid.move_player(direction);
// 	}
// }

class PuzzleGrid extends Entity {
	// static singleton = Game.add(new PuzzleGrid());
	has_wall(position) {
		// Check if there's a WallEntity at the given position
		return this.sub_entities.some(ent => 
			ent instanceof WallEntity && ent.r.p.equals(position));
	}

	has_boulder(position) {
		// Check if there's a BoulderEntity at the given position
		return this.sub_entities.some(ent => 
			ent instanceof BoulderEntity && ent.r.p.equals(position));
	}

	can_move(position) {
		// Check if the position is within the bounds and not occupied by a wall or a boulder
		return LevelController.level_rect.contains(position) &&
			   !this.has_wall(position) && !this.has_boulder(position);
	}

	can_push(position, direction) {
		// Check if there's a boulder at the position and if it can be moved in the given direction
		if (this.has_boulder(position)) {
			let newPos = position.clone().add(direction.clone().multiplyScalar(tile_size));
			return this.can_move(newPos);
		}
		return false;
	}

	is_on_teleporter(ent) {
		return ent instanceof PlayerEntity && this.sub_entities.some(e => 
			e instanceof TeleporterEntity && e.r.p.equals(ent.r.p));
	}

	teleport_entity_if_needed(ent, direction) {
		const teleporter = this.sub_entities.find(e => 
			e instanceof TeleporterEntity && e.r.p.equals(ent.r.p));
		if (teleporter) {
			ent.r.p = teleporter.destination.clone().add(direction.clone().multiplyScalar(tile_size));
		}
	}

	move_entity(ent, direction) {
		// Clone the current position and calculate the new position
		let newPos = ent.r.p.clone().add(direction.clone().multiplyScalar(tile_size));

		if (this.can_move(newPos)) {
			// Move the entity if the new position is valid
			ent.r.p = newPos;

			// Check for teleportation after moving
			if (this.is_on_teleporter(ent)) {
				this.teleport_entity_if_needed(ent, direction);
			}
			return true;
		} else if (ent instanceof PlayerEntity && this.can_push(newPos, direction)) {
			// If entity can't move but can push a boulder, move both entity and boulder
			let boulderPos = newPos;
			let newBoulderPos = boulderPos.clone().add(direction.clone().multiplyScalar(tile_size));

			// Find the boulder and update its position
			var boulder = this.sub_entities.find(ent => 
				ent instanceof BoulderEntity && ent.r.p.equals(boulderPos));

			// Update the entity's position
			boulder.r.p = newBoulderPos;
			ent.r.p = newPos;

			// Check for teleportation after moving
			if (this.is_on_teleporter(ent)) {
				this.teleport_entity_if_needed(ent, direction);
			}
			return true;
		}
		return false;
	}

	check_kill_stuff() {
		var player = this.sub_entities.find(ent => ent instanceof PlayerEntity);
		if (player && this.sub_entities.some(ent => (ent instanceof DemonEntity || ent instanceof MirrorDemonEntity) && player.r.p.equals(ent.r.p))) {
			this.remove(player);
			Game.main_text.post_message("press r to reset");
		}

		this.remove(this.sub_entities
			.filter(ent => ent instanceof DemonEntity)
			.filter(demon => this.sub_entities.some(ent => ent instanceof BoulderEntity && demon.r.p.equals(ent.r.p))));

		this.remove(this.sub_entities
			.filter(ent => ent instanceof TreasureEntity)
			.filter(demon => this.sub_entities.some(ent => ent instanceof PlayerEntity && demon.r.p.equals(ent.r.p)))
			.map(demon => { PlayerController.did_activate_mirror_demon = true; Game.singleton.entities.find(ent => ent instanceof PuzzleGrid).add(new MirrorDemonEntity(PlayerController.local_player.r.p.clone().add(tile_size, 0))); return demon }));

		this.remove(this.sub_entities
			.filter(ent => ent instanceof MirrorDemonEntity)
			.filter(demon => LevelController.current_level_data.identifier === 'Level_2')
			.map(demon => {
				PlayerController.player_won = true;
				Game.main_text.text = "you have put evil to rest\n perhaps you should rest as well...\n";
				return demon }));
	}

	move_player(direction) {
		this.sub_entities
			.filter(ent => ent instanceof MirrorDemonEntity)
			.forEach(demon => {
				this.memorize_mirror_image(demon);
			});

		this.sub_entities
			.filter(ent => ent instanceof PlayerEntity)
			.forEach(player => this.move_entity(player, direction));

		this.check_kill_stuff();

		// After moving the player, move all DemonEntities or turn them
		this.sub_entities
			.filter(ent => ent instanceof DemonEntity)
			.forEach(demon => {
				if (!this.move_entity(demon, demon.facing_direction)) {
					demon.turnDirection(); // Turn the demon if it cannot move
				}
			});
		this.sub_entities
			.filter(ent => ent instanceof MirrorDemonEntity)
			.forEach(demon => {
				this.move_mirror_image(demon);
			});

		this.check_kill_stuff();
	}

	memorize_mirror_image(demon) {
		if (PlayerController.local_player) {
			if (demon.follow_positions.length < 2)
				demon.follow_positions.push(PlayerController.local_player.r.p.clone());
			demon.follow_positions.push(PlayerController.local_player.r.p.clone());
		}
	}

	move_mirror_image(demon) {
		if (demon.follow_positions.length > 0) {
			var p = demon.follow_positions.shift();
			demon.r.p = p.clone();
		}
	}
}


class PlayerEntity extends ScreenEntity {
	constructor(position) {
		super(Game.assets.images.wolf_tileset.subimg(1,0), position, vec(tile_size,tile_size));
	}
}

class MirrorDemonEntity extends ScreenEntity {
	constructor(position) {
		super(Game.assets.images.wolf_tileset.subimg(0,0), position, vec(tile_size,tile_size));
		this.follow_positions = [position.clone()];
	}
}

class WallEntity extends ScreenEntity {
	constructor(position, image) {
		let wallImage = image || Game.assets.images.wolf_tileset.subimg(10, 9);
		super(wallImage, position, vec(tile_size, tile_size));
	}
}

class BoulderEntity extends ScreenEntity {
	constructor(position) {
		let boulderImage = Game.assets.images.wolf_tileset.subimg(18, 10);
		super(boulderImage, position, vec(tile_size, tile_size));
	}
}

class DemonEntity extends ScreenEntity {
	constructor(position, facingDirection=vec(1,0)) {
		let demonImage = Game.assets.images.wolf_tileset.subimg(16, 30);
		super(demonImage, position, vec(tile_size, tile_size));
		this.facing_direction = facingDirection; // Add facing_direction property
	}

	turnDirection() {
		// Turn facing direction 90 degrees clockwise
		this.facing_direction = vec(-this.facing_direction.y, this.facing_direction.x);
	}
}

class TeleporterEntity extends ScreenEntity {
	constructor(position, destination) {
		let teleporterImage = Game.assets.images.wolf_tileset.subimg(23, 10);
		super(teleporterImage, position, vec(tile_size, tile_size));
		this.destination = destination;
	}
}


class TreasureEntity extends ScreenEntity {
	constructor(position) {
		let image = Game.assets.images.wolf_tileset.subimg(18, 3);
		super(image, position, vec(tile_size, tile_size));
	}
}


class PlayerFollowCamera extends GameCamera {
	static view_greater_area = false;
	update() {
		if (PlayerController.local_player) {

			// this.r.p = PlayerController.local_player.r.p.clone();
			if (!this.move_square && LevelController.level_rect) {
				this.on_level_loaded();
			} else if (!this.move_square.contains(PlayerController.local_player.r.p)) {
				this.on_level_loaded();
			} else if (!PlayerFollowCamera.view_greater_area) {
				this.r.p = this.r.p.multiplyScalar(0.95).add(PlayerController.local_player.r.p.clone().multiplyScalar(0.05));
				this.move_square.box_point(this.r.p);
			}
		}
	}

	on_position_changed() {
		// find the level and load it
		var l = LevelController.find_level_by_position(PlayerController.local_player.r.p);
		if (l)
			LevelController.load_level(l);

		this.on_level_loaded();
	}

	on_level_loaded() {
		// calculate the scale of the camera to fit everything on screen
		var scale = Math.max(LevelController.level_rect.s.x / Game.singleton.canvas.width, LevelController.level_rect.s.y / Game.singleton.canvas.height);
		if (scale <= 1 || PlayerFollowCamera.view_greater_area) {
			this.scale = vec(1/scale,1/scale);
		} else {
			this.scale = vec(1,1);
		}

		// calculate our move-square by reducing the entire level rect
		// this.r.p = LevelController.level_rect.p.clone();
		this.move_square = LevelController.level_rect.clone();
		this.move_square.s.sub(vec(Game.singleton.canvas.width, Game.singleton.canvas.height));

		// floor the move-square to zero/zero so we don't have negative sizing
		this.move_square.s.x = Math.max(0, this.move_square.s.x);
		this.move_square.s.y = Math.max(0, this.move_square.s.y);

		// position the camera automatically as close as possible to the player on the move-square
		this.r.p = PlayerController.local_player.r.p.clone();
		this.move_square.box_point(this.r.p);
	}
}



class PlayerController extends Entity {
	static singleton = Game.add_service('player_controller', new PlayerController());
	static local_player;

	static saved_player_location;
	static did_activate_mirror_demon = false;
	static player_won = false;

	static save_player_state() {
		if (PlayerController.local_player)
			PlayerController.saved_player_location = PlayerController.local_player.r.p.clone();
	}
	static reload_player_state() {
		if (PlayerController.local_player)
			PlayerController.local_player.r.p = PlayerController.saved_player_location.clone();
		if (PlayerController.did_activate_mirror_demon) {
			var grid = Game.singleton.entities.find(ent => ent instanceof PuzzleGrid);
			var nearest_door = grid.sub_entities.find(ent => ent instanceof TeleporterEntity && ent.r.p.manhattanDistanceTo(PlayerController.local_player.r.p) === tile_size);
			grid.add(new MirrorDemonEntity(nearest_door.r.p));
		}
	}

	update() {
		const grid = Game.singleton.entities.find(ent => ent instanceof PuzzleGrid);

		if (PlayerController.local_player && !PlayerController.player_won) {
			var move_speed = Input.is_key_down('shift') ? 5 : 2;

			var direction = vec.zero;
			if (Input.is_key_pressed('a'))
				direction = vec(-1,0);
			else if (Input.is_key_pressed('s'))
				direction = vec(0,1);
			else if (Input.is_key_pressed('d'))
				direction = vec(1,0);
			else if (Input.is_key_pressed('w'))
				direction = vec(0,-1);
			else if (Input.is_key_pressed('r'))
				LevelController.reload_current_level();
			if (direction !== vec.zero)
				grid.move_player(direction);
			else if (Input.is_key_pressed('1'))
				console.log(Game.singleton.entities);

			if (Game.camera) {
				Game.camera.angle = PlayerController.local_player.angle;
				Game.camera.r.p = PlayerController.local_player.r.p.clone();
			}
		}
		// console.log("" + Game.camera.r.p);
	}
}


class LevelController extends Entity {
	static singleton = Game.add_service('level_controller', new LevelController());
	static world_data;
	static tileset_data = [];
	static entity_classes = {
		PlayerEntity: PlayerEntity,
		DemonEntity: DemonEntity,
		BoulderEntity: BoulderEntity,
		TeleporterEntity: TeleporterEntity,
		TreasureEntity: TreasureEntity,
	};
	static defined_enums = {
		Direction: { Down: vec.down, Left: vec.left, Right: vec.right, Up: vec.up },
	};
	static current_level_data = undefined;
	static load_level_by_id(level_id) {
		LevelController.load_level(LevelController.world_data.levels[level_id]);
	}

	static load_world() {
		// console.log("LevelController.world_data.tilesets:", LevelController.world_data);
		LevelController.world_data.defs.tilesets.forEach(tileset => {
			if (tileset.identifier === 'Wolf_tileset') {
				tileset.customData.forEach(data => {
					LevelController.tileset_data[data.tileId] = JSON.parse(data.data);
				});
			}
		});
	}

	static find_entity_by_ref(ref) {
		return LevelController.world_data
			.levels.find(level => level.iid === ref.levelIid)
			.layerInstances.find(layer => layer.iid === ref.layerIid)
			.entityInstances.find(layer => layer.iid === ref.entityIid);
	}

	static to_world_vec(ent_data) {
		return vec(ent_data.__worldX, ent_data.__worldY);
	}

	static reload_current_level(level_data) {
		level_data = LevelController.current_level_data;

		PlayerController.reload_player_state();

		LevelController.current_level_data = undefined;
		LevelController.load_level(level_data);
	}

	static load_level(level_data) {
		if (level_data === LevelController.current_level_data)
			return;

		LevelController.current_level_data = level_data;

		if (!PlayerController.did_activate_mirror_demon) {
			if (level_data.identifier === 'Level_2') {
				Game.main_text.post_message('use the w/a/s/d keys to move', 10);
			} else if (level_data.identifier === 'Level_3') {
				Game.main_text.post_message('use the r key to reset if you get stuck', 10);
			} else if (level_data.identifier === 'Level_4') {
				Game.main_text.post_message('good luck on your journey...');
			}
		}

		Game.remove([...Game.singleton.entities]);

		var new_grid = new PuzzleGrid();
		Game.add(new_grid);

		if (PlayerController.local_player) {
			new_grid.add(PlayerController.local_player);
		}

		LevelController.level_rect = rect(
				vec(level_data.worldX, level_data.worldY).add(
					vec(level_data.pxWid/2, level_data.pxHei/2)),
				vec(level_data.pxWid, level_data.pxHei));


		var tile_offset = vec(tile_size / 2, tile_size / 2);
		var offset = vec(level_data.worldX, level_data.worldY).add(tile_offset);

		level_data.layerInstances.forEach(layer => {
			if (layer.__identifier === 'EntitiesLayer') {
				for (var ent_data of layer.entityInstances) {
					var ent_class = this.entity_classes[ent_data.__identifier];
					if (ent_class) {
						if (ent_class !== PlayerEntity || !PlayerController.local_player) {
							var ent = new ent_class(vec(ent_data.px[0], ent_data.px[1]).add(offset));
							ent_data.fieldInstances.forEach(member_var => {
								ent[member_var.__identifier] =
									member_var.__type === 'Point' ? vec(member_var.__value.cx * tile_size, member_var.__value.cy * tile_size).add(offset) :
									member_var.__type === 'EntityRef' ? LevelController.to_world_vec(LevelController.find_entity_by_ref(member_var.__value)).add(tile_offset) :
									member_var.__type.startsWith('LocalEnum.') ? LevelController.defined_enums[member_var.__type.substring('LocalEnum.'.length)][member_var.__value] :
									member_var.value;
							});

							new_grid.add(ent);
						}
					} else {
						console.error("entity class not mapped, not instantiating: ", ent_data.__identifier);
					}
				}
			} else if (layer.__identifier === 'TerrainLayer') {
				for (var tile_data of layer.gridTiles) {
					var w = new WallEntity(
						vec(tile_data.px[0], tile_data.px[1]).add(offset),
						Game.assets.images.wolf_tileset.subimg(tile_data.src[0]/tile_size, tile_data.src[1]/tile_size));
					new_grid.add(w);
					// if (LevelController.tileset_data[tile_data.t]) {
					// 	var custom = LevelController.tileset_data[tile_data.t];
					// 	w.r.p.z = (custom.height - 1) / 2;
					// 	w.r.s = vec(1,custom.height);
					// }
				}
			} else {
				console.error("layer not mapped, not instantiating: ", layer.__identifier);
			}
		});

		PlayerController.local_player = new_grid?.sub_entities?.find(ent => ent instanceof PlayerEntity);
		PlayerController.save_player_state();
		PlayerController.reload_player_state();
	}

	static find_level_by_position(p) {
		return LevelController.world_data.levels.find(l => l.worldX <= p.x + tile_size / 2
				&& l.worldX + l.pxWid >= p.x + tile_size / 2
				&& l.worldY <= p.y + tile_size / 2
				&& l.worldY + l.pxHei >= p.y + tile_size / 2);
	}




	static on_level_changed() {
		// find the level and load it
		var l = LevelController.find_level_by_position(PlayerController.local_player.r.p);
		if (l)
			LevelController.load_level(l);
	}

	static load_player_level() {
		var l = LevelController.world_data.levels.find(
				level => level.layerInstances.find(layer => layer.entityInstances.find(ent_data => ent_data.__identifier === 'PlayerEntity')));
		if (l)
			LevelController.load_level(l);
	}


	update() {
		if (PlayerController.local_player) {
			// console.log("player:" + PlayerController.local_player.r.p);
			// this.r.p = PlayerController.local_player.r.p.clone();
			if (!LevelController.level_rect.contains(PlayerController.local_player.r.p)) {
				// console.log("rect:" + PlayerController.local_player.r.p, LevelController.level_rect);
				LevelController.on_level_changed();
			}
		}
	}
}


