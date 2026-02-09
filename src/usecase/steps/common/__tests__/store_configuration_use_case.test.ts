import { StoreConfigurationUseCase } from '../store_configuration_use_case';

jest.mock('../../../../utils/logger', () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
}));

const mockUpdate = jest.fn();
jest.mock('../../../../manager/description/configuration_handler', () => ({
  ConfigurationHandler: jest.fn().mockImplementation(() => ({
    update: mockUpdate,
  })),
}));

describe('StoreConfigurationUseCase', () => {
  let useCase: StoreConfigurationUseCase;

  beforeEach(() => {
    useCase = new StoreConfigurationUseCase();
    mockUpdate.mockReset();
  });

  it('calls handler.update with param', async () => {
    const param = { owner: 'o', repo: 'r' } as unknown as Parameters<StoreConfigurationUseCase['invoke']>[0];

    await useCase.invoke(param);

    expect(mockUpdate).toHaveBeenCalledWith(param);
  });

  it('does not throw when handler.update throws (caught and logged)', async () => {
    mockUpdate.mockRejectedValue(new Error('Update failed'));

    await expect(useCase.invoke({} as Parameters<StoreConfigurationUseCase['invoke']>[0])).resolves.not.toThrow();
  });
});
