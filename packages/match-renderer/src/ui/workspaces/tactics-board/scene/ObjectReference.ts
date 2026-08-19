/**
 * A generic reference from any spatial entity in the scene to a
 * BoardObject, by id. Carries no behavior and no meaning of its own -- a
 * plain pointer, reusable as-is by any future feature, in any workspace,
 * that needs to point at a scene object (animation, analysis, AI, export,
 * or anything else). Never embeds or copies the BoardObject; scene.objects
 * stays the only place one actually lives.
 */

export type ObjectReference = { objectId: string };
