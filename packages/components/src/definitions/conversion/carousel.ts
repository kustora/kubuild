import { isVariableBinding } from '@kubuild/schema';
import { ComponentDefinition } from '../../registry';
import { ariaLabelTrait, idTrait } from '../../traits';

/**
 * Carousel (STORA-546). Every child node is one slide. Autoplay is disabled in the
 * editor and whenever the visitor prefers reduced motion.
 */
export const carouselDefinition: ComponentDefinition = {
  type: 'carousel',
  label: 'Carousel',
  category: 'interactive',
  icon: 'carousel',
  description: 'Slider for product galleries and testimonials; each child is a slide.',
  acceptsChildren: true,
  allowedChildren: ['*'],
  defaultProps: {
    autoplay: false,
    interval: 5000,
    loop: true,
    showDots: true,
    showArrows: true,
  },
  defaultChildren: [
    { type: 'container', children: [{ type: 'paragraph', props: { text: 'Slide 1' } }] },
    { type: 'container', children: [{ type: 'paragraph', props: { text: 'Slide 2' } }] },
    { type: 'container', children: [{ type: 'paragraph', props: { text: 'Slide 3' } }] },
  ],
  propFields: [
    { name: 'autoplay', label: 'Autoplay', type: 'boolean', defaultValue: false },
    { name: 'interval', label: 'Autoplay Interval (ms)', type: 'number', defaultValue: 5000 },
    { name: 'loop', label: 'Loop', type: 'boolean', defaultValue: true },
    { name: 'showDots', label: 'Show Dots', type: 'boolean', defaultValue: true },
    { name: 'showArrows', label: 'Show Arrows', type: 'boolean', defaultValue: true },
  ],
  traits: [
    idTrait(),
    ariaLabelTrait({ description: 'Accessible name for the carousel, e.g. "Testimonials".' }),
  ],
  defaultStyles: {
    base: {
      position: 'relative',
      width: '100%',
      overflow: 'hidden',
    },
  },
  validateProps: (props) => {
    const errors: string[] = [];
    const interval = props.interval;
    if (
      interval !== undefined &&
      !isVariableBinding(interval) &&
      (typeof interval !== 'number' || !(interval > 0))
    ) {
      errors.push('Carousel "interval" must be a positive number of milliseconds.');
    }
    return errors;
  },
};
