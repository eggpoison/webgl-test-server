import { TileInfo, TileType } from "webgl-test-shared";
import BaseTile from "./Tile";
import DirtTile from "./DirtTile";
import GrassTile from "./GrassTile";
import IceTile from "./IceTile";
import LavaTile from "./LavaTile";
import MagmaTile from "./MagmaTile";
import RockTile from "./RockTile";
import SandstoneTile from "./SandstoneTile";
import SandTile from "./SandTile";
import SludgeTile from "./SludgeTile";
import SnowTile from "./SnowTile";
import WaterTile from "./WaterTile";

const TILE_CLASS_RECORD: Record<TileType, new(x: number, y: number, info: TileInfo) => BaseTile> = {
   grass: GrassTile,
   dirt: DirtTile,
   water: WaterTile,
   sludge: SludgeTile,
   rock: RockTile,
   sand: SandTile,
   sandstone: SandstoneTile,
   snow: SnowTile,
   ice: IceTile,
   magma: MagmaTile,
   lava: LavaTile
};

export default TILE_CLASS_RECORD;