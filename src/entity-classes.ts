import { EntityType, Point } from "webgl-test-shared";
import Boulder from "./entities/resources/Boulder";
import Cow from "./entities/mobs/Cow";
import Entity from "./entities/Entity";
import Player from "./entities/Player";
import Tombstone from "./entities/Tombstone";
import Tree from "./entities/resources/Tree";
import Workbench from "./entities/Workbench";
import Zombie from "./entities/mobs/Zombie";
import BerryBush from "./entities/resources/BerryBush";
import Cactus from "./entities/resources/Cactus";
import Yeti from "./entities/mobs/Yeti";

const ENTITY_CLASS_RECORD: Record<EntityType, () => (new (position: Point, ...args: any[]) => Entity)> = {
   cow: () => Cow,
   zombie: () => Zombie,
   tombstone: () => Tombstone,
   player: () => Player,
   tree: () => Tree,
   workbench: () => Workbench,
   boulder: () => Boulder,
   berry_bush: () => BerryBush,
   cactus: () => Cactus,
   yeti: () => Yeti
};

export const RESOURCE_ENTITY_TYPES: ReadonlyArray<EntityType> = ["berry_bush", "boulder", "cactus", "tree"];
export const MOB_ENTITY_TYPES: ReadonlyArray<EntityType> = ["cow", "zombie"];

export default ENTITY_CLASS_RECORD;