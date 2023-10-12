import { Point, RiverSteppingStoneData, RiverSteppingStoneSize } from "webgl-test-shared";
import { GameObject } from "./GameObject";
import Projectile from "./Projectile";
import Entity from "./entities/Entity";
import DroppedItem from "./items/DroppedItem";
import Mob from "./entities/mobs/Mob";

export interface RiverSteppingStone {
   readonly position: Point;
   readonly rotation: number;
   readonly size: RiverSteppingStoneSize;
}

class Chunk {
   /** Stores all game objects inside the chunk */
   public readonly gameObjects = new Array<GameObject>();
   
   public readonly entities = new Set<Entity>();
   public readonly droppedItems = new Set<DroppedItem>();
   public readonly projectiles = new Set<Projectile>();

   /** Stores all mobs which have the chunk in their vision range */
   public readonly viewingMobs = new Array<Mob>();

   public readonly riverSteppingStones = new Array<RiverSteppingStone>();

   public readonly x: number;
   public readonly y: number;

   constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
   }

   public addGameObject(gameObject: GameObject): void {
      this.gameObjects.push(gameObject);

      switch (gameObject.i) {
         case "entity": {
            this.entities.add(gameObject);
            break;
         }
         case "droppedItem": {
            this.droppedItems.add(gameObject);
            break;
         }
         case "projectile": {
            this.projectiles.add(gameObject);
         }
      }

      const numViewingMobs = this.viewingMobs.length;
      for (let i = 0; i < numViewingMobs; i++) {
         const mob = this.viewingMobs[i];
         const idx = mob.potentialVisibleGameObjects.indexOf(gameObject);
         if (idx === -1) {
            mob.potentialVisibleGameObjects.push(gameObject);
            mob.potentialVisibleGameObjectAppearances.push(1);
         } else {
            mob.potentialVisibleGameObjectAppearances[idx]++;
         }
      }
   }

   public removeGameObject(gameObject: GameObject): void {
      const idx = this.gameObjects.indexOf(gameObject);
      if (idx !== -1) {
         this.gameObjects.splice(idx, 1);
      }

      switch (gameObject.i) {
         case "entity": {
            this.entities.delete(gameObject);
            break;
         }
         case "droppedItem": {
            this.droppedItems.delete(gameObject);
            break;
         }
         case "projectile": {
            this.projectiles.delete(gameObject);
         }
      }

      const numViewingMobs = this.viewingMobs.length;
      for (let i = 0; i < numViewingMobs; i++) {
         const mob = this.viewingMobs[i];
         const idx = mob.potentialVisibleGameObjects.indexOf(gameObject);
         if (idx === -1) {
            throw new Error();
         }
         mob.potentialVisibleGameObjectAppearances[idx]--;
         if (mob.potentialVisibleGameObjectAppearances[idx] === 0) {
            mob.potentialVisibleGameObjects.splice(idx, 1);
            mob.potentialVisibleGameObjectAppearances.splice(idx, 1);
         }
      }
   }

   public addRiverSteppingStone(steppingStoneData: RiverSteppingStoneData): void {
      const steppingStone: RiverSteppingStone = {
         position: Point.unpackage(steppingStoneData.position),
         rotation: steppingStoneData.rotation,
         size: steppingStoneData.size
      };
      this.riverSteppingStones.push(steppingStone);
   }
}

export default Chunk;