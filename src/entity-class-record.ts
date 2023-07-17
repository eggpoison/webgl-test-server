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

const ENTITY_CLASS_RECORD: Record<EntityType, () => (new (position: Point, ...args: any[]) => Entity)> = {
   cow: () => Cow,
   zombie: () => Zombie,
   tombstone: () => Tombstone,
   player: () => Player,
   tree: () => Tree,
   workbench: () => Workbench,
   boulder: () => Boulder,
   berry_bush: () => BerryBush
};

export default ENTITY_CLASS_RECORD;