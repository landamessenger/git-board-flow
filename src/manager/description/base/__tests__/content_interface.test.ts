import { ContentInterface } from '../content_interface';

jest.mock('../../../../utils/logger', () => ({
  logError: jest.fn(),
}));

/** Concrete implementation for testing the abstract ContentInterface. */
class TestContent extends ContentInterface {
  constructor(
    public readonly testId: string,
    public readonly testVisible: boolean,
  ) {
    super();
  }
  get id(): string {
    return this.testId;
  }
  get visibleContent(): boolean {
    return this.testVisible;
  }
}

describe('ContentInterface', () => {
  describe('visibleContent: true (HTML comment style)', () => {
    const handler = new TestContent('foo', true);
    const start = '<!-- copilot-foo-start -->';
    const end = '<!-- copilot-foo-end -->';

    describe('getContent', () => {
      it('returns undefined when description is undefined', () => {
        expect(handler.getContent(undefined)).toBeUndefined();
      });

      it('returns undefined when start pattern is missing', () => {
        const desc = `pre\n${end}\npost`;
        expect(handler.getContent(desc)).toBeUndefined();
      });

      it('returns undefined when end pattern is missing', () => {
        const desc = `pre\n${start}\nmid`;
        expect(handler.getContent(desc)).toBeUndefined();
      });

      it('returns content between start and end patterns', () => {
        const desc = `pre\n${start}\ninner\n${end}\npost`;
        expect(handler.getContent(desc)).toBe('\ninner\n');
      });

      it('returns first block when multiple blocks exist', () => {
        const desc = `${start}\nfirst\n${end}\n${start}\nsecond\n${end}`;
        expect(handler.getContent(desc)).toBe('\nfirst\n');
      });

      it('returns undefined when only start tag is present', () => {
        const desc = `pre\n${start}\norphan`;
        expect(handler.getContent(desc)).toBeUndefined();
      });

      it('logs and rethrows when extraction throws', () => {
        const desc = `pre\n${start}\ninner\n${end}\npost`;
        const originalSplit = String.prototype.split;
        (jest.spyOn(String.prototype, 'split') as jest.Mock).mockImplementation(
          function (this: string, separator: unknown, limit?: number) {
            if (separator === start) {
              return ['only-one-element'];
            }
            return (originalSplit as (sep: string, limit?: number) => string[]).call(
              this,
              separator as string,
              limit,
            );
          },
        );
        const { logError } = require('../../../../utils/logger');

        expect(() => handler.getContent(desc)).toThrow();
        expect(logError).toHaveBeenCalledWith(
          expect.stringMatching(/Error reading issue configuration/),
        );

        (String.prototype.split as jest.Mock).mockRestore();
      });
    });

    describe('updateContent', () => {
      it('returns undefined when description is undefined', () => {
        expect(handler.updateContent(undefined, 'x')).toBeUndefined();
      });

      it('returns undefined when content is undefined', () => {
        expect(handler.updateContent('body', undefined)).toBeUndefined();
      });

      it('appends new block when no existing block', () => {
        const desc = 'some body';
        const result = handler.updateContent(desc, 'new');
        expect(result).toBe(`some body\n\n${start}\nnew\n${end}`);
      });

      it('replaces existing block when block exists', () => {
        const desc = `pre\n${start}\nold\n${end}\npost`;
        const result = handler.updateContent(desc, 'new');
        expect(result).toBe(`pre\n${start}\nnew\n${end}\npost`);
      });

      it('returns undefined when only start tag exists (cannot add, update fails)', () => {
        const desc = `pre\n${start}\norphan`;
        const result = handler.updateContent(desc, 'new');
        expect(result).toBeUndefined();
      });

      it('logs and returns undefined when update throws', () => {
        const desc = `pre\n${start}\nold\n${end}\npost`;
        const originalSplit = String.prototype.split;
        (jest.spyOn(String.prototype, 'split') as jest.Mock).mockImplementation(
          function (this: string, separator: unknown, limit?: number) {
            if (separator === start) {
              throw new Error('split failed');
            }
            return (originalSplit as (sep: string, limit?: number) => string[]).call(
              this,
              separator as string,
              limit,
            );
          },
        );
        const { logError } = require('../../../../utils/logger');

        const result = handler.updateContent(desc, 'new');

        expect(result).toBeUndefined();
        expect(logError).toHaveBeenCalledWith(
          expect.stringMatching(/Error updating issue description/),
        );

        (String.prototype.split as jest.Mock).mockRestore();
      });
    });
  });

  describe('visibleContent: false (hidden comment style)', () => {
    const handler = new TestContent('config', false);
    const start = '<!-- copilot-config-start';
    const end = 'copilot-config-end -->';

    describe('getContent', () => {
      it('returns undefined when description is undefined', () => {
        expect(handler.getContent(undefined)).toBeUndefined();
      });

      it('returns undefined when start pattern is missing', () => {
        expect(handler.getContent(`pre\n${end}\npost`)).toBeUndefined();
      });

      it('returns undefined when end pattern is missing', () => {
        expect(handler.getContent(`pre\n${start}\nmid`)).toBeUndefined();
      });

      it('returns content between start and end patterns', () => {
        const desc = `pre\n${start}\n{"x":1}\n${end}\npost`;
        expect(handler.getContent(desc)).toBe('\n{"x":1}\n');
      });
    });

    describe('updateContent', () => {
      it('appends new block when no existing block', () => {
        const desc = 'body';
        const result = handler.updateContent(desc, 'data');
        expect(result).toBe(`body\n\n${start}\ndata\n${end}`);
      });

      it('replaces existing block when block exists', () => {
        const desc = `pre\n${start}\nold\n${end}\npost`;
        const result = handler.updateContent(desc, 'new');
        expect(result).toBe(`pre\n${start}\nnew\n${end}\npost`);
      });
    });
  });
});
