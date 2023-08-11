import { Point } from "webgl-test-shared";
import Entity from "../../entities/Entity";
import PlaceableItem from "../generic/PlaceableItem";
import TribeTotem from "../../entities/tribes/TribeTotem";
import TribeMember from "../../entities/tribes/TribeMember";

class TribeTotemItem extends PlaceableItem {
   protected spawnEntity(_tribeMember: TribeMember, position: Point): Entity {
      return new TribeTotem(position, false);
   }
}

export default TribeTotemItem;