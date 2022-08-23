import Chunk from "../Chunk";
import { Point, SETTINGS, Vector } from "webgl-test-shared";
import Component from "../entity-components/Component";
import { SERVER } from "../server";

abstract class Entity {
   private readonly components = new Map<(abstract new (...args: any[]) => any), Component>();

   /** Position of the entity */
   public position: Point;
   /** Velocity of the entity */
   public velocity: Vector | null = null;
   /** Acceleration of the entity */
   public acceleration: Vector | null = null;

   public previousChunk: Chunk;

   constructor(position: Point, velocity: Vector | null, acceleration: Vector | null, components: Array<Component>) {
      this.position = position;
      this.velocity = velocity;
      this.acceleration = acceleration;

      this.previousChunk = this.findContainingChunk();

      for (const component of components) {
         this.components.set(component.constructor as (new (...args: any[]) => any), component);

         component.setEntity(this);
      }
   }

   public onLoad?(): void;

   public loadComponents(): void {
      this.components.forEach(component => {
         if (typeof component.onLoad !== "undefined") component.onLoad();
      });
   }

   public tick(): void {
      this.components.forEach(component => {
         if (typeof component.tick !== "undefined") {
            component.tick();
         }
      });
   }

   public getComponent<C extends Component>(constr: { new(...args: any[]): C }): C | null {
      const component = this.components.get(constr);
      return typeof component !== "undefined" ? (component as C) : null;
   }

   public findContainingChunk(): Chunk {
      const chunkX = Math.floor(this.position.x / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE);
      const chunkY = Math.floor(this.position.y / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE);

      return SERVER.chunks[chunkX][chunkY];
   }
}

export default Entity;