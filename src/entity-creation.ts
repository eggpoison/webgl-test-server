import { IEntityType, Point, TribeType } from "webgl-test-shared";
import Entity from "./GameObject";
import { createBarrel } from "./entities/tribes/barrel";
import { createBerryBush } from "./entities/resources/berry-bush";
import { createBoulder } from "./entities/resources/boulder";
import { createCactus } from "./entities/resources/cactus";
import { createCampfire } from "./entities/cooking-entities/campfire";
import { createCow } from "./entities/mobs/cow";
import { createFish } from "./entities/mobs/fish";
import { createFrozenYeti } from "./entities/mobs/frozen-yeti";
import { createFurnace } from "./entities/cooking-entities/furnace";
import { createIceSpikes } from "./entities/resources/ice-spikes";
import { createKrumblid } from "./entities/mobs/krumblid";
import { createPlayer } from "./entities/tribes/player";
import { createSlime } from "./entities/mobs/slime";
import { createSlimewisp } from "./entities/mobs/slimewisp";
import { createSnowball } from "./entities/snowball";
import { createTombstone } from "./tombstone";
import { createTree } from "./entities/resources/tree";
import { createWorkbench } from "./entities/workbench";
import { createYeti } from "./entities/mobs/yeti";
import { createZombie } from "./entities/mobs/zombie";

export function createEntity(position: Point, entityType: IEntityType): Entity {
   switch (entityType) {
      case IEntityType.barrel: return createBarrel(position);
      case IEntityType.berryBush: return createBerryBush(position);
      case IEntityType.boulder: return createBoulder(position);
      case IEntityType.cactus: return createCactus(position);
      case IEntityType.campfire: return createCampfire(position);
      case IEntityType.cow: return createCow(position);
      case IEntityType.fish: return createFish(position);
      case IEntityType.frozenYeti: return createFrozenYeti(position);
      case IEntityType.furnace: return createFurnace(position);
      case IEntityType.iceSpikes: return createIceSpikes(position);
      case IEntityType.krumblid: return createKrumblid(position);
      case IEntityType.player: return createPlayer(position, TribeType.plainspeople, null);
      case IEntityType.slime: return createSlime(position);
      case IEntityType.slimewisp: return createSlimewisp(position);
      case IEntityType.snowball: return createSnowball(position);
      case IEntityType.tombstone: return createTombstone(position);
      case IEntityType.tree: return createTree(position);
      case IEntityType.workbench: return createWorkbench(position);
      case IEntityType.yeti: return createYeti(position);
      case IEntityType.zombie: return createZombie(position);
      case IEntityType.woodenArrowProjectile:
      case IEntityType.iceShardProjectile:
      case IEntityType.rockSpikeProjectile:
      case IEntityType.tribesman:
      case IEntityType.tribeTotem:
      case IEntityType.tribeHut:
      case IEntityType.itemEntity: throw new Error("Can't dynamically create entity of type '" + entityType + "'.");
   }
}