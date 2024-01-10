import { IEntityType, Point } from "webgl-test-shared";
import Entity, { ID_SENTINEL_VALUE } from "./Entity";
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
import { createSlime } from "./entities/mobs/slime";
import { createSlimewisp } from "./entities/mobs/slimewisp";
import { createSnowball } from "./entities/snowball";
import { createTombstone } from "./entities/tombstone";
import { createTree } from "./entities/resources/tree";
import { createWorkbench } from "./entities/workbench";
import { createYeti } from "./entities/mobs/yeti";
import { createZombie } from "./entities/mobs/zombie";
import { createResearchBench } from "./entities/research-bench";
import { createWoodenWall } from "./entities/structures/wooden-wall";
import { createSpitPoison } from "./entities/projectiles/spit-poison";
import { createWoodenDoor } from "./entities/structures/wooden-door";
import { createGolem } from "./entities/mobs/golem";

export function createEntity(position: Point, entityType: IEntityType): Entity {
   switch (entityType) {
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
      case IEntityType.slime: return createSlime(position);
      case IEntityType.slimewisp: return createSlimewisp(position);
      case IEntityType.snowball: return createSnowball(position);
      case IEntityType.tombstone: return createTombstone(position);
      case IEntityType.tree: return createTree(position);
      case IEntityType.workbench: return createWorkbench(position);
      case IEntityType.yeti: return createYeti(position);
      case IEntityType.zombie: return createZombie(position, false, ID_SENTINEL_VALUE);
      case IEntityType.researchBench: return createResearchBench(position);
      case IEntityType.woodenWall: return createWoodenWall(position, null);
      case IEntityType.woodenDoor: return createWoodenDoor(position, null, 0);
      case IEntityType.spitPoison: return createSpitPoison(position);
      case IEntityType.golem: return createGolem(position);
      case IEntityType.slimeSpit:
      case IEntityType.woodenArrowProjectile:
      case IEntityType.player:
      case IEntityType.iceShardProjectile:
      case IEntityType.rockSpikeProjectile:
      case IEntityType.spearProjectile:
      case IEntityType.battleaxeProjectile:
      case IEntityType.barrel:
      case IEntityType.tribeWorker:
      case IEntityType.tribeWarrior:
      case IEntityType.tribeTotem:
      case IEntityType.workerHut:
      case IEntityType.warriorHut:
      case IEntityType.itemEntity: throw new Error("Can't dynamically create entity of type '" + entityType + "'.");
   }
}