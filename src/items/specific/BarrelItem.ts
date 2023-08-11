import { Point } from "webgl-test-shared";
import Entity from "../../entities/Entity";
import TribeMember from "../../entities/tribes/TribeMember";
import PlaceableItem from "../generic/PlaceableItem";
import Barrel from "../../entities/tribes/Barrel";

class BarrelItem extends PlaceableItem {
   protected spawnEntity(_tribeMember: TribeMember, position: Point): Entity {
      return new Barrel(position, false);
   }

}

export default BarrelItem;