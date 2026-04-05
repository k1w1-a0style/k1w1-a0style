type ReturnSections<
  TLocalProject extends object,
  TToken extends object,
  TRepos extends object,
  TSelection extends object,
  TUiStates extends object,
  TFiltersAndForms extends object,
  TOps extends object,
  TPushUi extends object,
  TPullUi extends object,
  TSync extends object,
  TEas extends object,
  TGitHubApiHelpers extends object,
  TBranchOps extends object,
  TManageModal extends object,
> = {
  localProject: TLocalProject;
  token: TToken;
  repos: TRepos;
  selection: TSelection;
  uiStates: TUiStates;
  filtersAndForms: TFiltersAndForms;
  ops: TOps;
  pushUi: TPushUi;
  pullUi: TPullUi;
  sync: TSync;
  eas: TEas;
  githubApiHelpers: TGitHubApiHelpers;
  branchOps: TBranchOps;
  manageModal: TManageModal;
};

export const buildGitHubReposScreenReturnModel = <
  TLocalProject extends object,
  TToken extends object,
  TRepos extends object,
  TSelection extends object,
  TUiStates extends object,
  TFiltersAndForms extends object,
  TOps extends object,
  TPushUi extends object,
  TPullUi extends object,
  TSync extends object,
  TEas extends object,
  TGitHubApiHelpers extends object,
  TBranchOps extends object,
  TManageModal extends object,
>(
  sections: ReturnSections<
    TLocalProject,
    TToken,
    TRepos,
    TSelection,
    TUiStates,
    TFiltersAndForms,
    TOps,
    TPushUi,
    TPullUi,
    TSync,
    TEas,
    TGitHubApiHelpers,
    TBranchOps,
    TManageModal
  >,
): TLocalProject &
  TToken &
  TRepos &
  TSelection &
  TUiStates &
  TFiltersAndForms &
  TOps &
  TPushUi &
  TPullUi &
  TSync &
  TEas &
  TGitHubApiHelpers &
  TBranchOps &
  TManageModal => {
  return {
    ...sections.localProject,
    ...sections.token,
    ...sections.repos,
    ...sections.selection,
    ...sections.uiStates,
    ...sections.filtersAndForms,
    ...sections.ops,
    ...sections.pushUi,
    ...sections.pullUi,
    ...sections.sync,
    ...sections.eas,
    ...sections.githubApiHelpers,
    ...sections.branchOps,
    ...sections.manageModal,
  };
};
