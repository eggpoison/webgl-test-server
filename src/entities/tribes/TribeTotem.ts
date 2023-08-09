import { GameObjectDebugData, Point, TribeTotemBanner, TribeType, randInt } from "webgl-test-shared";
import Entity from "../Entity";
import HealthComponent from "../../entity-components/HealthComponent";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import Tribe from "../../Tribe";

interface TotemPosition {
   readonly layer: number;
   readonly direction: number;   
}

const TRIBE_TOTEM_POSITIONS = new Array<TotemPosition>();

const NUM_TOTEM_POSITIONS = [4, 6, 8];

for (let layerIdx = 0; layerIdx < 3; layerIdx++) {
   const numPositions = NUM_TOTEM_POSITIONS[layerIdx];
   for (let j = 0; j < numPositions; j++) {
      const angle = j / numPositions * 2 * Math.PI;
      TRIBE_TOTEM_POSITIONS.push({
         layer: layerIdx,
         direction: angle
      });
   }
}

class TribeTotem extends Entity {
   private static readonly MAX_HEALTH = 50;

   private static readonly RADIUS = 60;

   public tribe: Tribe | null = null;

   private readonly banners = new Array<TribeTotemBanner>();

   private readonly availableBannerPositions = Array.from(new Set(TRIBE_TOTEM_POSITIONS));
   
   constructor(position: Point, isNaturallySpawned: boolean) {
      super(position, {
         health: new HealthComponent(TribeTotem.MAX_HEALTH, false)
      }, "tribe_totem", isNaturallySpawned);

      this.addHitboxes([
         new CircularHitbox({
            type: "circular",
            radius: TribeTotem.RADIUS
         })
      ]);

      this.isStatic = true;
   }

   public setTribe(tribe: Tribe | null): void {
      this.tribe = tribe;
   }

   public createNewBanner(): void {
      const positionIdx = randInt(0, this.availableBannerPositions.length - 1);
      const position = this.availableBannerPositions[positionIdx];
      this.availableBannerPositions.splice(positionIdx, 1);
      
      const banner: TribeTotemBanner = {
         layer: position.layer,
         direction: position.direction
      };
      this.banners.push(banner);
   }

   public getClientArgs(): [tribeID: number, tribeType: TribeType, banners: Array<TribeTotemBanner>] {
      return [this.tribe !== null ? this.tribe.id : -1, this.tribe?.tribeType || 0, this.banners];
   }

   public getDebugData(): GameObjectDebugData {
      const debugData = super.getDebugData();

      if (this.tribe !== null) {
         // Show the tribe's area
         for (const tile of this.tribe.getArea()) {
            debugData.tileHighlights.push({
               colour: [1, 0, 0],
               tilePosition: [tile.x, tile.y]
            });
         }
      }

      return debugData;
   }
}

export default TribeTotem;