import { EntityType, Point } from "webgl-test-shared";
import Cow from "./entities/Cow";
import Entity from "./entities/Entity";
import Player from "./entities/Player";
import Tombstone from "./entities/Tombstone";
import Tree from "./entities/Tree";
import Workbench from "./entities/Workbench";
import Zombie from "./entities/Zombie";

const ENTITY_CLASS_RECORD: Record<EntityType, () => (new (position: Point, ...args: any) => Entity)> = {
   cow: () => Cow,
   zombie: () => Zombie,
   tombstone: () => Tombstone,
   player: () => Player,
   tree: () => Tree,
   workbench: () => Workbench
};

export default ENTITY_CLASS_RECORD;