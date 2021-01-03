import { Component, OnInit } from '@angular/core'
import { Router, ActivatedRoute, ParamMap } from '@angular/router'
import { FormGroup, FormControl } from '@angular/forms'
import { Title } from '@angular/platform-browser'

import { MessageService } from 'primeng/api'
import { ConfirmationService } from 'primeng/api'

import { ManagementService } from '../backend/api/management.service'
import { BreadcrumbsService } from '../breadcrumbs.service'
import { Branch } from '../backend/model/models'

@Component({
    selector: 'app-branch-mgmt',
    templateUrl: './branch-mgmt.component.html',
    styleUrls: ['./branch-mgmt.component.sass'],
})
export class BranchMgmtComponent implements OnInit {
    branchId: number
    branch: Branch = { id: 0, name: 'noname', stages: [] }
    newBranchName: string

    newStageDlgVisible = false
    stageName = ''
    newStageName: string
    newStageDescr: string

    stage: any = { id: 0, name: '', description: '' }
    saveErrorMsg = ''

    codeMirrorOpts = {
        lineNumbers: true,
        theme: 'material',
        mode: 'text/x-python',
        indentUnit: 4,
        gutters: ['CodeMirror-lint-markers'],
        lint: true,
    }

    codeMirrorJsonOpts = {
        lineNumbers: true,
        theme: 'material',
        mode: 'application/json',
    }

    schemaCheckDisplay = false
    schemaCheckContent: any

    schemaFromRepoForm = new FormGroup({
        repo_url: new FormControl(''),
        repo_branch: new FormControl(''),
        repo_access_token: new FormControl(''),
        schema_file: new FormControl(''),
        repo_refresh_interval: new FormControl(''),
    })

    sequences = []

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        protected managementService: ManagementService,
        protected breadcrumbService: BreadcrumbsService,
        private msgSrv: MessageService,
        private confirmationService: ConfirmationService,
        private titleService: Title
    ) {}

    ngOnInit() {
        this.schemaCheckContent = { schema: '', error: '' }
        this.route.paramMap.subscribe(params => {
            this.branchId = parseInt(params.get('id'), 10)
            this.refresh()
        })
    }

    refresh() {
        this.managementService.getBranch(this.branchId).subscribe(branch => {
            this.titleService.setTitle('Kraken - Branch Management - ' + branch.name)
            this.branch = branch
            this.newBranchName = branch.name
            this.stage = null  // reset selected stage
            if (this.stageName !== '') {
                // this is a finish of adding new stage ie. select newly created stage
                for (const s of this.branch.stages) {
                    if (s.name === this.stageName) {
                        this.selectStage(s)
                        this.stageName = ''
                        break
                    }
                }
            }
            if (this.stage === null) {
                this.selectStage(branch.stages[0])
            }

            const crumbs = [
                {
                    label: 'Projects',
                    project_id: branch.project_id,
                    project_name: branch.project_name,
                },
                {
                    label: 'Branches',
                    branch_id: branch.id,
                    branch_name: branch.name,
                },
            ]
            this.breadcrumbService.setCrumbs(crumbs)
        })
        this.managementService.getBranchSequences(this.branchId).subscribe(data => {
            this.sequences = data.items
        })
    }

    selectStage(stage) {
        if (this.stage) {
            this.stage.selectedClass = ''
        }
        this.stage = stage
        this.stage.selectedClass = 'selectedClass'

        const val = {
            repo_url: stage.repo_url,
            repo_branch: stage.repo_branch,
            repo_access_token: stage.repo_access_token,
            schema_file: stage.schema_file,
            repo_refresh_interval: stage.repo_refresh_interval,
        }
        this.schemaFromRepoForm.setValue(val)

        if (stage.repo_error) {
            this.saveErrorMsg = 'loading schema erred:<br>' + stage.repo_error.replaceAll('\n', '<br>')
        }

    }

    newStage() {
        this.newStageDlgVisible = true
    }

    cancelNewStage() {
        this.newStageDlgVisible = false
    }

    newStageKeyDown(event) {
        if (event.key === 'Enter') {
            this.addNewStage()
        }
    }

    addNewStage() {
        this.managementService
            .createStage(this.branchId, { name: this.stageName })
            .subscribe(
                data => {
                    this.msgSrv.add({
                        severity: 'success',
                        summary: 'New stage succeeded',
                        detail: 'New stage operation succeeded.',
                    })
                    this.newStageDlgVisible = false
                    this.refresh()
                },
                err => {
                    let msg = err.statusText
                    if (err.error && err.error.detail) {
                        msg = err.error.detail
                    }
                    this.msgSrv.add({
                        severity: 'error',
                        summary: 'New stage erred',
                        detail: 'New stage operation erred: ' + msg,
                        life: 10000,
                    })
                    this.newStageDlgVisible = false
                }
            )
    }

    saveStage() {
        this.saveErrorMsg = ''

        let stage = {
            name: this.stage.name,
            schema_code: this.stage.schema_code,
            enabled: this.stage.enabled,
            schema_from_repo_enabled: this.stage.schema_from_repo_enabled,
        }
        stage = Object.assign(stage, this.schemaFromRepoForm.value)
        this.doSaveStage(stage)
    }

    checkStageSchema() {
        this.managementService
            .getStageSchemaAsJson(this.stage.id, {
                schema_code: this.stage.schema_code,
            })
            .subscribe(
                data => {
                    this.schemaCheckContent = data
                    this.schemaCheckDisplay = true
                },
                err => {
                    let msg = err.statusText
                    if (err.error && err.error.detail) {
                        msg = err.error.detail
                    }
                    this.msgSrv.add({
                        severity: 'error',
                        summary: 'Check schema erred',
                        detail: 'Check schema operation erred: ' + msg,
                        life: 10000,
                    })
                }
            )
    }

    deleteStage() {
        this.confirmationService.confirm({
            message:
                'Do you really want to delete stage "' + this.stage.name + '"?',
            accept: () => {
                this.managementService.deleteStage(this.stage.id).subscribe(
                    stage => {
                        this.selectStage(this.branch.stages[0])
                        this.msgSrv.add({
                            severity: 'success',
                            summary: 'Stage deletion succeeded',
                            detail: 'Stage deletion operation succeeded.',
                        })
                        this.refresh()
                    },
                    err => {
                        let msg = err.statusText
                        if (err.error && err.error.detail) {
                            msg = err.error.detail
                        }
                        this.msgSrv.add({
                            severity: 'error',
                            summary: 'Stage deletion erred',
                            detail: 'Stage deletion operation erred: ' + msg,
                            life: 10000,
                        })
                    }
                )
            },
        })
    }

    branchNameKeyDown(event, branchNameInplace) {
        if (event.key === 'Enter') {
            branchNameInplace.deactivate()
        }
        if (event.key === 'Escape') {
            branchNameInplace.deactivate()
            this.newBranchName = this.branch.name
        }
    }

    doSaveStage(stageData) {
        this.managementService.updateStage(this.stage.id, stageData).subscribe(
            stage => {
                this.selectStage(stage)
                for (const idx in this.branch.stages) {
                    if (this.branch.stages[idx].id === stage.id) {
                        this.branch.stages[idx] = stage
                        break
                    }
                }
                this.msgSrv.add({
                    severity: 'success',
                    summary: 'Stage update succeeded',
                    detail: 'Stage update operation succeeded.',
                })

                // if repo schema is being refreshed then refresh stage again in 10s
                if (stage.repo_state === 1) {
                    setTimeout(() => {
                        this.refreshStage(stage.id)
                    }, 10000)
                }
            },
            err => {
                let msg = err.statusText
                if (err.error && err.error.detail) {
                    msg = err.error.detail
                }
                this.msgSrv.add({
                    severity: 'error',
                    summary: 'Stage update erred',
                    detail: 'Stage update operation erred: ' + msg,
                    life: 10000,
                })
            }
        )
    }

    refreshStage(stageId) {
        this.managementService.getStage(stageId).subscribe(
            stage => {
                // update stage data in ui
                for (const idx in this.branch.stages) {
                    if (this.branch.stages[idx].id === stage.id) {
                        this.branch.stages[idx] = stage
                        if (this.stage.id === stage.id) {
                            this.selectStage(stage)
                        }
                        break
                    }
                }

                // if repo schema is still being refreshed then refresh stage again in 10s
                if (stage.repo_state === 1) {
                    setTimeout(() => {
                        this.refreshStage(stage.id)
                    }, 10000)
                }
            }
        )
    }

    stageNameInplaceActivated() {
        this.newStageName = this.stage.name
    }

    stageNameKeyDown(event, stageNameInplace) {
        if (event.key === 'Enter') {
            stageNameInplace.deactivate()
            const stage = {
                name: this.newStageName,
            }
            this.doSaveStage(stage)
        }
        if (event.key === 'Escape') {
            stageNameInplace.deactivate()
        }
    }

    stageDescrInplaceActivated() {
        this.newStageDescr = this.stage.description
    }

    stageDescrKeyDown(event, stageDescrInplace) {
        if (event.key === 'Enter') {
            stageDescrInplace.deactivate()
            const stage = {
                name: this.stage.name,
                description: this.newStageDescr,
            }
            this.doSaveStage(stage)
        }
        if (event.key === 'Escape') {
            stageDescrInplace.deactivate()
        }
    }

    forkBranch() {}

    getSeqTypeName(seq) {
        switch (seq.kind) {
        case 0:
            return 'flow'
        case 1:
            return 'CI flow'
        case 2:
            return 'DEV flow'
        case 3:
            return 'run'
        case 4:
            return 'CI run'
        case 5:
            return 'DEV run'
        }
        return 'unknown'
    }
}
