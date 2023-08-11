import { Point } from "webgl-test-shared";
import Entity from "../../entities/Entity";
import TribeMember from "../../entities/tribes/TribeMember";
import PlaceableItem from "../generic/PlaceableItem";
import Furnace from "../../entities/Furnace";

class FurnaceItem extends PlaceableItem {
   protected spawnEntity(_tribeMember: TribeMember, position: Point): Entity {
      return new Furnace(position, false);
   }
}

export default FurnaceItem;