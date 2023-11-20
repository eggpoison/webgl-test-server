import { EntityType, EntityTypeConst, Point } from "webgl-test-shared";
import Boulder from "./entities/resources/Boulder";
import Cow from "./entities/mobs/Cow";
import Entity from "./entities/Entity";
import Player from "./entities/tribes/Player";
import Tombstone from "./entities/Tombstone";
import Tree from "./entities/resources/Tree";
import Workbench from "./entities/Workbench";
import Zombie from "./entities/mobs/Zombie";
import BerryBush from "./entities/resources/BerryBush";
import Cactus from "./entities/resources/Cactus";
import Yeti from "./entities/mobs/Yeti";
import IceSpikes from "./entities/resources/IceSpikes";
import Slime from "./entities/mobs/Slime";
import Slimewisp from "./entities/mobs/Slimewisp";
import Tribesman from "./entities/tribes/Tribesman";
import TribeTotem from "./entities/tribes/TribeTotem";
import TribeHut from "./entities/tribes/TribeHut";
import Barrel from "./entities/tribes/Barrel";
import Campfire from "./entities/cooking-entities/Campfire";
import Furnace from "./entities/cooking-entities/Furnace";
import Snowball from "./entities/Snowball";
import Krumblid from "./entities/mobs/Krumblid";
import FrozenYeti from "./entities/mobs/FrozenYeti";
import Fish from "./entities/mobs/Fish";

const ENTITY_CLASS_RECORD: Record<EntityType, () => (new (position: Point, ...args: any[]) => Entity)> = {
   [EntityTypeConst.cow]: () => Cow,
   [EntityTypeConst.zombie]: () => Zombie,
   [EntityTypeConst.tombstone]: () => Tombstone,
   [EntityTypeConst.tree]: () => Tree,
   [EntityTypeConst.workbench]: () => Workbench,
   [EntityTypeConst.boulder]: () => Boulder,
   [EntityTypeConst.berry_bush]: () => BerryBush,
   [EntityTypeConst.cactus]: () => Cactus,
   [EntityTypeConst.yeti]: () => Yeti,
   [EntityTypeConst.ice_spikes]: () => IceSpikes,
   [EntityTypeConst.slime]: () => Slime,
   [EntityTypeConst.slimewisp]: () => Slimewisp,
   [EntityTypeConst.tribesman]: () => Tribesman,
   [EntityTypeConst.player]: () => Player,
   [EntityTypeConst.tribe_totem]: () => TribeTotem,
   [EntityTypeConst.tribe_hut]: () => TribeHut,
   [EntityTypeConst.barrel]: () => Barrel,
   [EntityTypeConst.campfire]: () => Campfire,
   [EntityTypeConst.furnace]: () => Furnace,
   [EntityTypeConst.snowball]: () => Snowball,
   [EntityTypeConst.krumblid]: () => Krumblid,
   [EntityTypeConst.frozen_yeti]: () => FrozenYeti,
   [EntityTypeConst.fish]: () => Fish
};

export default ENTITY_CLASS_RECORD;