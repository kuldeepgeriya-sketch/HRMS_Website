const tabs = document.querySelectorAll('.tab');
const pages = document.querySelectorAll('.tab-page');
const subPages = document.querySelectorAll('.sub-page');
const dropdownItems = document.querySelectorAll('.dropdown-menu li');
const message = document.getElementById('message');
const state = { employees: [], departments: [], designations: [], offices: [], shifts: [], leave_types: [] };
let currentEmployeeId = null;
let currentUser = null;
let employeeSortCol = null;
let employeeSortAsc = true;

function showMessage(text, type = 'success') {
    message.textContent = text;
    message.className = `message show ${type}`;
    setTimeout(() => {
        message.className = 'message';
        message.textContent = '';
    }, 4000);
}

function switchTab(tabName) {
    if (typeof closeEmployeeActionMenu === 'function') closeEmployeeActionMenu();
    if (typeof closeAttendanceStatusMenu === 'function') closeAttendanceStatusMenu();
    tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.tab === tabName));
    pages.forEach(page => page.classList.toggle('active', page.id === tabName));
    if (tabName === 'joining-form') {
        if (typeof clearJoiningForm === 'function') clearJoiningForm();
    }
    // Set first sub-page active
    const activePage = document.querySelector(`#${tabName}`);
    if (activePage) {
        const firstSub = activePage.querySelector('.sub-page');
        if (firstSub) {
            activePage.querySelectorAll('.sub-page').forEach(sub => sub.classList.remove('active'));
            firstSub.classList.add('active');
        }
    }
}

function switchSubPage(tabName, subName) {
    if (typeof closeEmployeeActionMenu === 'function') closeEmployeeActionMenu();
    if (typeof closeAttendanceStatusMenu === 'function') closeAttendanceStatusMenu();
    const page = document.getElementById(tabName);
    if (page) {
        page.querySelectorAll('.sub-page').forEach(sub => sub.classList.remove('active'));
        const subPage = document.getElementById(subName);
        if (subPage) {
            subPage.classList.add('active');
            // Load data for the sub-page
            if (subName === 'attendance') {
                // Reset attendance views to show summary
                getEl('attendanceActionsView')?.classList.add('hidden');
                getEl('attendanceDetailView')?.classList.add('hidden');
                getEl('allAttendanceMarkView')?.classList.add('hidden');
                getEl('attendanceFilterPanel')?.classList.remove('hidden');
                getEl('attendanceSummaryView')?.classList.remove('hidden');
                currentAttendanceEmployee = null;
                loadAttendance();
                applyUserRestrictions();  // re-hide mark buttons for employees
            } else if (subName === 'leave') {
                loadLeaveBalances();
                loadLeaveRequests();
            } else if (subName === 'statutory') {
                loadStatutory();
            } else if (subName === 'employee-records') {
                renderFilteredEmployees();
            } else if (subName === 'employee-detail') {
                if (!currentEmployeeId) {
                    clearEmployeeForm();
                }
            }
        }
    }
}

tabs.forEach(tab => tab.addEventListener('click', () => {
    switchTab(tab.dataset.tab);
    setTimeout(applyUserRestrictions, 50);  // re-enforce hiding after tab switch
}));

dropdownItems.forEach(item => item.addEventListener('click', () => {
    const tabName = item.closest('.tab-dropdown').querySelector('.tab').dataset.tab;
    const subName = item.dataset.sub;
    switchTab(tabName);
    switchSubPage(tabName, subName);
}));

async function fetchJson(url, options = {}) {
    const response = await fetch(url, options);
    if (!response.ok) {
        const contentType = response.headers.get('Content-Type') || '';
        if (contentType.includes('application/json')) {
            const data = await response.json();
            throw new Error(data.error || 'Request failed');
        }
        throw new Error('Request failed');
    }
    return await response.json();
}

function fillSelect(select, items, labelKey = 'name', valueKey = 'id', includeBlank = true) {
    if (!select) return;
    select.innerHTML = '';
    if (includeBlank) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = '-- Select --';
        select.appendChild(option);
    }
    items.forEach(item => {
        const option = document.createElement('option');
        const value = valueKey ? item[valueKey] : item;
        let label;
        if (typeof labelKey === 'function') {
            label = labelKey(item);
        } else {
            label = item[labelKey] || item.title || item.name || item.location || item;
        }
        option.value = value;
        option.textContent = label;
        select.appendChild(option);
    });
}

function convertNumberToWords(value) {
    const ones = ['Zero','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
    const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];

    function twoDigits(num) {
        if (num < 20) return ones[num];
        const unit = num % 10;
        return tens[Math.floor(num / 10)] + (unit ? ' ' + ones[unit] : '');
    }

    function threeDigits(num) {
        const hundred = Math.floor(num / 100);
        const rest = num % 100;
        return (hundred ? ones[hundred] + ' Hundred' + (rest ? ' ' + twoDigits(rest) : '') : twoDigits(rest));
    }

    if (value === 0) return 'Zero';
    const parts = [];
    const crore = Math.floor(value / 10000000);
    if (crore) {
        parts.push(threeDigits(crore) + ' Crore');
        value %= 10000000;
    }
    const lakh = Math.floor(value / 100000);
    if (lakh) {
        parts.push(threeDigits(lakh) + ' Lakh');
        value %= 100000;
    }
    const thousand = Math.floor(value / 1000);
    if (thousand) {
        parts.push(threeDigits(thousand) + ' Thousand');
        value %= 1000;
    }
    if (value) {
        parts.push(threeDigits(value));
    }
    return parts.join(' ').trim();
}

function getEl(id) {
    return document.getElementById(id);
}

function setDefaultDates() {
    const today = new Date().toISOString().slice(0, 10);
    const offerDate = getEl('offer_date');
    const empJoiningDate = getEl('emp_joining_date');
    const attendanceDate = getEl('attendance_date');
    const attendanceFilterStart = getEl('attendance_filter_start');
    const attendanceFilterEnd = getEl('attendance_filter_end');
    const allMarkDate = getEl('all_mark_date');
    const leaveStart = getEl('leave_start');
    const leaveEnd = getEl('leave_end');
    const payrollYear = getEl('payroll_year');
    const payrollMonth = getEl('payroll_month');

    if (offerDate) offerDate.value = today;
    if (empJoiningDate) empJoiningDate.value = today;
    if (attendanceDate) attendanceDate.value = today;
    if (attendanceFilterStart) attendanceFilterStart.value = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    if (attendanceFilterEnd) attendanceFilterEnd.value = today;
    if (allMarkDate) allMarkDate.value = today;
    if (leaveStart) leaveStart.value = today;
    if (leaveEnd) leaveEnd.value = today;
    if (payrollYear) payrollYear.value = new Date().getFullYear();
    if (payrollMonth) payrollMonth.value = new Date().getMonth() + 1;
}

function updateLetterAmounts() {
    const monthlyInput = getEl('monthly_ctc');
    const monthly_word = getEl('monthly_word');
    const annual_ctc = getEl('annual_ctc');
    const annual_word = getEl('annual_word');
    const monthly = monthlyInput ? Number(monthlyInput.value || 0) : 0;

    if (!monthly_word || !annual_ctc || !annual_word) return;
    if (!Number.isFinite(monthly) || monthly <= 0) {
        monthly_word.value = '';
        annual_ctc.value = '';
        annual_word.value = '';
        return;
    }
    const annual = monthly * 12;
    monthly_word.value = `${convertNumberToWords(monthly)} Only`;
    annual_ctc.value = annual;
    annual_word.value = `${convertNumberToWords(annual)} Only`;
}

async function loadLookups() {
    const data = await fetchJson('/api/lookups');
    state.departments = data.departments;
    state.designations = data.designations;
    state.offices = data.offices;
    state.shifts = data.shifts;
    state.employees = data.employees;
    state.leave_types = data.leave_types;

    // Filter to only self for regular employees
    if (currentUser && currentUser.employee_id && currentUser.is_admin !== true) {
        state.employees = state.employees.filter(emp => emp.id === currentUser.employee_id);
    }

    populateEmployeeFilters();
    // reset filters/search on full data reload to show all
    const sEl = getEl('empSearch'); if (sEl) sEl.value = '';
    ['filterDept','filterDesig','filterOffice','filterManager'].forEach(fid => {
        const f = getEl(fid); if (f) f.value = '';
    });

    fillSelect(document.getElementById('emp_department'), state.departments, 'name', 'id');
    fillSelect(document.getElementById('designation_department'), state.departments, 'name', 'id');
    fillSelect(document.getElementById('emp_designation'), state.designations, 'title', 'id');
    fillSelect(document.getElementById('emp_office'), state.offices, 'name', 'id');
    const employeeLabel = emp => `${emp.first_name} ${emp.last_name}`;
    const includeBlankAtt = !(currentUser && currentUser.employee_id && currentUser.is_admin !== true);
    fillSelect(document.getElementById('attendance_filter_employee'), state.employees, employeeLabel, 'id', includeBlankAtt);
    // For regular employees, default the attendance filter to only themselves (no blank)
    const attFilterSel = document.getElementById('attendance_filter_employee');
    if (attFilterSel && currentUser && currentUser.employee_id && currentUser.is_admin !== true) {
        attFilterSel.value = currentUser.employee_id;
    }
    fillSelect(document.getElementById('attendance_employee'), state.employees, employeeLabel, 'id');
    fillSelect(document.getElementById('attendance_shift'), state.shifts, 'name', 'id');
    fillSelect(document.getElementById('leave_type'), state.leave_types, item => item, null, false);
    fillSelect(document.getElementById('leave_employee'), state.employees, employeeLabel, 'id');
    fillSelect(document.getElementById('payroll_employee'), state.employees, employeeLabel, 'id');

    const managerSelect = document.getElementById('emp_manager');
    managerSelect.innerHTML = '<option value="">-- None --</option>';
    state.employees.forEach(emp => {
        const option = document.createElement('option');
        option.value = emp.id;
        option.textContent = `${emp.first_name} ${emp.last_name}`;
        managerSelect.appendChild(option);
    });

    updateEmployeeFormOptions();
    renderFilteredEmployees();
    renderDepartmentTable(state.departments);
    renderDesignationTable(state.designations);
    renderOfficeTable(state.offices);
    renderShiftTable(state.shifts);
    renderHierarchyTable(state.employees);
    await loadAttendance();
    await loadLeaveBalances();
    await loadLeaveRequests();
    await loadPayrolls();
    await loadStatutory();
}

function updateEmployeeFormOptions() {
    const employeeLabel = emp => `${emp.first_name} ${emp.last_name}`;
    fillSelect(document.getElementById('attendance_employee'), state.employees, employeeLabel, 'id');
    fillSelect(document.getElementById('attendance_shift'), state.shifts, 'name', 'id');
    fillSelect(document.getElementById('leave_employee'), state.employees, employeeLabel, 'id');
    fillSelect(document.getElementById('payroll_employee'), state.employees, employeeLabel, 'id');
}

function renderEmployeeTable(employees) {
    const tbody = document.querySelector('#employeesTable tbody');
    tbody.innerHTML = '';
    let toRender = [...employees];
    if (employeeSortCol) {
        toRender.sort((a, b) => {
            let va = '', vb = '';
            if (employeeSortCol === 'code') {
                va = (a.employee_code || '').toLowerCase();
                vb = (b.employee_code || '').toLowerCase();
            } else if (employeeSortCol === 'name') {
                va = ((a.first_name || '') + (a.last_name || '')).toLowerCase();
                vb = ((b.first_name || '') + (b.last_name || '')).toLowerCase();
            } else if (employeeSortCol === 'email') {
                va = (a.email || '').toLowerCase();
                vb = (b.email || '').toLowerCase();
            } else if (employeeSortCol === 'phone') {
                va = (a.phone || '').toLowerCase();
                vb = (b.phone || '').toLowerCase();
            } else if (employeeSortCol === 'department') {
                va = (a.department_name || '').toLowerCase();
                vb = (b.department_name || '').toLowerCase();
            } else if (employeeSortCol === 'designation') {
                va = (a.designation_title || '').toLowerCase();
                vb = (b.designation_title || '').toLowerCase();
            } else if (employeeSortCol === 'office') {
                va = (a.office_name || '').toLowerCase();
                vb = (b.office_name || '').toLowerCase();
            } else if (employeeSortCol === 'manager') {
                va = (a.manager_name || '').toLowerCase();
                vb = (b.manager_name || '').toLowerCase();
            } else if (employeeSortCol === 'gender') {
                va = (a.gender || '').toLowerCase();
                vb = (b.gender || '').toLowerCase();
            } else if (employeeSortCol === 'status') {
                va = (a.status || '').toLowerCase();
                vb = (b.status || '').toLowerCase();
            } else if (employeeSortCol === 'joining_date') {
                va = (a.joining_date || '').toLowerCase();
                vb = (b.joining_date || '').toLowerCase();
            } else if (employeeSortCol === 'ctc') {
                va = a.ctc || 0;
                vb = b.ctc || 0;
                return employeeSortAsc ? (va - vb) : (vb - va);
            }
            if (va < vb) return employeeSortAsc ? -1 : 1;
            if (va > vb) return employeeSortAsc ? 1 : -1;
            return 0;
        });
    }
    toRender.forEach(emp => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td></td>
            <td>${emp.first_name} ${emp.last_name}</td>
            <td>${emp.email || ''}</td>
            <td>${emp.phone || ''}</td>
            <td>${emp.department_name || ''}</td>
            <td>${emp.designation_title || ''}</td>
            <td>${emp.office_name || ''}</td>
            <td>${emp.manager_name || ''}</td>
            <td>${emp.gender || ''}</td>
            <td>${emp.status || ''}</td>
            <td>${emp.joining_date || ''}</td>
            <td>${emp.ctc || ''}</td>
        `;
        const codeCell = row.querySelector('td');
        codeCell.textContent = emp.employee_code || '';
        codeCell.className = 'employee-code-cell';
        codeCell.dataset.employeeId = emp.id;
        tbody.appendChild(row);
    });
    updateEmployeeSortHeaders();
}

function updateEmployeeSortHeaders() {
    const ths = document.querySelectorAll('#employeesTable thead th[data-col]');
    ths.forEach(th => {
        const col = th.dataset.col;
        let baseText = th.dataset.baseText || th.textContent.replace(/[↑↓\s]+$/g, '').trim();
        th.dataset.baseText = baseText;
        if (col === employeeSortCol) {
            th.textContent = baseText + (employeeSortAsc ? ' ↑' : ' ↓');
        } else {
            th.textContent = baseText;
        }
    });
}

function sortEmployeesBy(col) {
    if (employeeSortCol === col) {
        employeeSortAsc = !employeeSortAsc;
    } else {
        employeeSortCol = col;
        employeeSortAsc = true;
    }
    renderFilteredEmployees();
}

function getFilteredEmployees() {
    let list = [...(state.employees || [])];
    const searchEl = getEl('empSearch');
    const search = searchEl ? (searchEl.value || '').toLowerCase().trim() : '';
    const deptEl = getEl('filterDept');
    const desigEl = getEl('filterDesig');
    const officeEl = getEl('filterOffice');
    const mgrEl = getEl('filterManager');
    const fDept = deptEl ? deptEl.value : '';
    const fDesig = desigEl ? desigEl.value : '';
    const fOffice = officeEl ? officeEl.value : '';
    const fMgr = mgrEl ? mgrEl.value : '';

    if (search) {
        list = list.filter(emp => {
            const code = (emp.employee_code || '').toLowerCase();
            const name = `${emp.first_name || ''} ${emp.last_name || ''}`.toLowerCase();
            return code.includes(search) || name.includes(search);
        });
    }
    if (fDept) list = list.filter(emp => String(emp.department_id || '') === fDept);
    if (fDesig) list = list.filter(emp => String(emp.designation_id || '') === fDesig);
    if (fOffice) list = list.filter(emp => String(emp.office_id || '') === fOffice);
    if (fMgr) list = list.filter(emp => String(emp.manager_id || '') === fMgr);
    return list;
}

function renderFilteredEmployees() {
    const filtered = getFilteredEmployees();
    renderEmployeeTable(filtered);
}

function populateEmployeeFilters() {
    const deptSel = getEl('filterDept');
    if (deptSel) {
        deptSel.innerHTML = '<option value="">All Departments</option>';
        (state.departments || []).forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.id;
            opt.textContent = d.name;
            deptSel.appendChild(opt);
        });
    }
    const desigSel = getEl('filterDesig');
    if (desigSel) {
        desigSel.innerHTML = '<option value="">All Designations</option>';
        (state.designations || []).forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.id;
            opt.textContent = d.title;
            desigSel.appendChild(opt);
        });
    }
    const officeSel = getEl('filterOffice');
    if (officeSel) {
        officeSel.innerHTML = '<option value="">All Offices</option>';
        (state.offices || []).forEach(o => {
            const opt = document.createElement('option');
            opt.value = o.id;
            opt.textContent = o.name;
            officeSel.appendChild(opt);
        });
    }
    const mgrSel = getEl('filterManager');
    if (mgrSel) {
        mgrSel.innerHTML = '<option value="">All Managers</option>';
        (state.employees || []).forEach(e => {
            const opt = document.createElement('option');
            opt.value = e.id;
            opt.textContent = `${e.first_name || ''} ${e.last_name || ''}`.trim();
            mgrSel.appendChild(opt);
        });
    }
}

function renderDepartmentTable(items) {
    const tbody = document.querySelector('#departmentTable tbody');
    tbody.innerHTML = '';
    items.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.name}</td>
            <td>${item.description || ''}</td>
            <td><button class="btn btn-danger small" data-id="${item.id}">Delete</button></td>
        `;
        row.querySelector('button').addEventListener('click', () => deleteDepartment(item.id));
        tbody.appendChild(row);
    });
}

function renderDesignationTable(items) {
    const tbody = document.querySelector('#designationTable tbody');
    tbody.innerHTML = '';
    items.forEach(item => {
        const department = state.departments.find(dep => dep.id === item.department_id);
        const departmentName = department ? department.name : '';
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.title}</td>
            <td>${departmentName}</td>
            <td><button class="btn btn-danger small" data-id="${item.id}">Delete</button></td>
        `;
        row.querySelector('button').addEventListener('click', () => deleteDesignation(item.id));
        tbody.appendChild(row);
    });
}

function renderOfficeTable(items) {
    const tbody = document.querySelector('#officeTable tbody');
    tbody.innerHTML = '';
    items.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.name}</td>
            <td>${item.location || ''}</td>
            <td><button class="btn btn-danger small" data-id="${item.id}">Delete</button></td>
        `;
        row.querySelector('button').addEventListener('click', () => deleteOffice(item.id));
        tbody.appendChild(row);
    });
}

function renderShiftTable(items) {
    const tbody = document.querySelector('#shiftTable tbody');
    tbody.innerHTML = '';
    items.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.name}</td>
            <td>${item.start_time} - ${item.end_time}</td>
            <td>${item.description || ''}</td>
            <td><button class="btn btn-danger small" data-id="${item.id}">Delete</button></td>
        `;
        row.querySelector('button').addEventListener('click', () => deleteShift(item.id));
        tbody.appendChild(row);
    });
}

function renderHierarchyTable(employees) {
    const tbody = document.querySelector('#hierarchyTable tbody');
    tbody.innerHTML = '';
    employees.forEach(emp => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${emp.first_name} ${emp.last_name}</td>
            <td>${emp.department_name || ''}</td>
            <td>${emp.designation_title || ''}</td>
            <td>${emp.office_name || ''}</td>
            <td>${emp.manager_name || ''}</td>
        `;
        tbody.appendChild(row);
    });
}

function renderStatutoryTable(items) {
    const tbody = document.querySelector('#statutoryTable tbody');
    tbody.innerHTML = '';
    items.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.name}</td>
            <td><input type="checkbox" data-id="${item.id}" data-field="pf_active" ${item.pf_active ? 'checked' : ''}></td>
            <td><input type="checkbox" data-id="${item.id}" data-field="esic_active" ${item.esic_active ? 'checked' : ''}></td>
            <td><input type="checkbox" data-id="${item.id}" data-field="pt_active" ${item.pt_active ? 'checked' : ''}></td>
            <td><input type="checkbox" data-id="${item.id}" data-field="lwf_active" ${item.lwf_active ? 'checked' : ''}></td>
        `;
        tbody.appendChild(row);
    });
    // Add event listeners for checkboxes
    tbody.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', async () => {
            const employeeId = checkbox.dataset.id;
            const field = checkbox.dataset.field;
            const value = checkbox.checked ? 1 : 0;
            try {
                await fetch(`/api/employees/${employeeId}/statutory`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ [field]: value })
                });
                showMessage('Statutory setting updated.', 'success');
            } catch (error) {
                showMessage('Failed to update statutory setting.', 'error');
                checkbox.checked = !checkbox.checked; // Revert
            }
        });
    });
}

function loadEmployee(emp) {
    currentEmployeeId = emp.id;
    document.getElementById('emp_code').value = emp.employee_code || '';
    document.getElementById('emp_first_name').value = emp.first_name || '';
    document.getElementById('emp_last_name').value = emp.last_name || '';
    document.getElementById('emp_email').value = emp.email || '';
    document.getElementById('emp_phone').value = emp.phone || '';
    document.getElementById('emp_dob').value = emp.dob || '';
    document.getElementById('emp_gender').value = emp.gender || 'Male';
    document.getElementById('emp_department').value = emp.department_id || '';
    document.getElementById('emp_designation').value = emp.designation_id || '';
    document.getElementById('emp_office').value = emp.office_id || '';
    document.getElementById('emp_manager').value = emp.manager_id || '';
    document.getElementById('emp_joining_date').value = emp.joining_date || '';
    document.getElementById('emp_ctc').value = emp.ctc || '';
    document.getElementById('emp_status').value = emp.status || 'Active';
    document.getElementById('emp_address').value = emp.address || '';
    // Update form mode for edit
    const titleEl = document.getElementById('employeeFormTitle');
    if (titleEl) titleEl.textContent = 'Edit Employee';
    const saveBtn = document.getElementById('saveEmployee');
    if (saveBtn) saveBtn.textContent = 'Update Employee';
    showMessage('Employee loaded for editing.', 'success');
}

function clearEmployeeForm() {
    currentEmployeeId = null;
    document.getElementById('emp_code').value = '';
    document.getElementById('emp_first_name').value = '';
    document.getElementById('emp_last_name').value = '';
    document.getElementById('emp_email').value = '';
    document.getElementById('emp_phone').value = '';
    document.getElementById('emp_dob').value = '';
    document.getElementById('emp_gender').value = 'Male';
    document.getElementById('emp_department').value = '';
    document.getElementById('emp_designation').value = '';
    document.getElementById('emp_office').value = '';
    document.getElementById('emp_manager').value = '';
    document.getElementById('emp_joining_date').value = new Date().toISOString().slice(0, 10);
    document.getElementById('emp_ctc').value = '';
    document.getElementById('emp_status').value = 'Active';
    document.getElementById('emp_address').value = '';
    const titleEl = document.getElementById('employeeFormTitle');
    if (titleEl) titleEl.textContent = 'Add Employee';
    const saveBtn = document.getElementById('saveEmployee');
    if (saveBtn) saveBtn.textContent = 'Save Employee';
}

async function saveJoiningForm() {
    try {
        // Manual validation for mandatory fields (since custom FormData submit bypasses HTML required)
        const requiredText = [
            'joining_full_name', 'joining_contact_no', 'joining_email_id', 'joining_designation',
            'joining_joining_date', 'joining_permanent_address', 'joining_date_of_birth',
            'joining_gender', 'joining_marital_status', 'joining_pan_no', 'joining_aadhar_no',
            'joining_bank_name', 'joining_bank_account_number', 'joining_ifsc_code', 'joining_branch_name',
            'joining_highest_qualification', 'joining_university_board', 'joining_year_of_passing', 'joining_percentage_grade',
            'joining_emergency_person_name', 'joining_emergency_person_mobile', 'joining_emergency_relation'
        ];
        for (let id of requiredText) {
            const el = getEl(id);
            if (!el || !(el.value || '').trim()) {
                showMessage('Please fill all mandatory details before submitting.', 'error');
                return;
            }
        }

        // Emergency address type must be selected
        const addrTypeEl = getEl('joining_emergency_address_type');
        if (!addrTypeEl || !addrTypeEl.value) {
            showMessage('Please select Person Address option (Same As Permanent or Other).', 'error');
            return;
        }
        const addrEl = getEl('joining_emergency_person_address');
        if (addrTypeEl.value === 'other' && (!addrEl || !(addrEl.value || '').trim())) {
            showMessage('Please specify the Person Address when selecting Other.', 'error');
            return;
        }

        // Mandatory document uploads
        const requiredFiles = [
            'joining_photo', 'joining_pan_card', 'joining_aadhar_card', 
            'joining_cheque_passbook', 'joining_highest_education_cert'
        ];
        for (let id of requiredFiles) {
            const el = getEl(id);
            if (!el || !el.files || el.files.length === 0) {
                showMessage('Please upload all mandatory documents (Photo, PAN, Aadhar, Cheque/Passbook, Education Certificate).', 'error');
                return;
            }
        }

        const formData = new FormData();

        // Handle emergency address: if "same", copy from permanent address (before appending)
        const permAddrEl = getEl('joining_permanent_address');
        if (addrTypeEl && addrEl && permAddrEl) {
            if (addrTypeEl.value === 'same') {
                addrEl.value = permAddrEl.value || '';
            }
        }

        // Text fields
        const textFieldIds = [
            'joining_full_name', 'joining_contact_no', 'joining_email_id', 'joining_designation',
            'joining_joining_date', 'joining_permanent_address', 'joining_date_of_birth',
            'joining_gender', 'joining_marital_status', 'joining_pan_no', 'joining_aadhar_no',
            'joining_bank_name', 'joining_bank_account_number', 'joining_ifsc_code', 'joining_branch_name',
            'joining_highest_qualification', 'joining_university_board', 'joining_year_of_passing', 'joining_percentage_grade',
            'joining_emergency_person_name', 'joining_emergency_person_mobile', 'joining_emergency_relation', 'joining_emergency_person_address',
            'joining_emergency_address_type',
            'joining_prev_company_name', 'joining_prev_designation', 'joining_prev_duration', 'joining_prev_last_salary'
        ];
        textFieldIds.forEach(id => {
            const el = getEl(id);
            if (el) {
                formData.append(id, el.value ? (el.value.trim ? el.value.trim() : el.value) : '');
            }
        });
        // File fields
        const fileFieldIds = [
            'joining_photo', 'joining_pan_card', 'joining_aadhar_card', 'joining_cheque_passbook',
            'joining_highest_education_cert', 'joining_last_3_month_salary_slip', 'joining_prev_employment_docs'
        ];
        fileFieldIds.forEach(id => {
            const el = getEl(id);
            if (el && el.files && el.files.length > 0) {
                formData.append(id, el.files[0]);
            }
        });

        const response = await fetch('/api/employee-joining-forms', {
            method: 'POST',
            body: formData
        });
        const result = await response.json();
        if (response.ok && result.success) {
            // Show nice welcome greeting with generated code
            const welcomeDiv = document.createElement('div');
            welcomeDiv.className = 'panel';
            welcomeDiv.style.marginTop = '20px';
            welcomeDiv.innerHTML = `
                <div class="panel-header"><h2>🎉 Welcome to Exceledge Family!</h2></div>
                <div style="padding: 30px; text-align: center; font-size: 1.2rem;">
                    <p>Your details have been received and are now pending admin approval.</p>
                    <p style="font-size: 1.5rem; font-weight: bold; margin: 20px 0; color: #ffeb3b;">
                        Your Employee Code is - ${result.employee_code}
                    </p>
                    <p>You will be contacted soon with further instructions.</p>
                </div>
            `;
            
            const formPanel = document.querySelector('#joining-form .panel');
            if (formPanel) {
                formPanel.style.display = 'none';
            }
            
            const container = document.querySelector('#joining-form');
            if (container) {
                container.appendChild(welcomeDiv);
            }
            
            // Also show toast
            showMessage(`Welcome! Your Employee Code is ${result.employee_code}`, 'success');
        } else {
            showMessage(result.error || 'Failed to submit form.', 'error');
        }
    } catch (err) {
        showMessage(err.message, 'error');
    }
}

function clearJoiningForm() {
    const fields = [
        'joining_full_name', 'joining_contact_no', 'joining_email_id', 'joining_designation',
        'joining_joining_date', 'joining_permanent_address', 'joining_date_of_birth',
        'joining_gender', 'joining_marital_status', 'joining_pan_no', 'joining_aadhar_no',
        'joining_bank_name', 'joining_bank_account_number', 'joining_ifsc_code', 'joining_branch_name',
        'joining_highest_qualification', 'joining_university_board', 'joining_year_of_passing', 'joining_percentage_grade',
        'joining_emergency_person_name', 'joining_emergency_person_mobile', 'joining_emergency_relation', 'joining_emergency_person_address',
        'joining_emergency_address_type',
        'joining_prev_company_name', 'joining_prev_designation', 'joining_prev_duration', 'joining_prev_last_salary',
        'joining_photo', 'joining_pan_card', 'joining_aadhar_card', 'joining_cheque_passbook',
        'joining_highest_education_cert', 'joining_last_3_month_salary_slip', 'joining_prev_employment_docs'
    ];
    fields.forEach(id => {
        const el = getEl(id);
        if (el) {
            if (el.tagName === 'SELECT') {
                el.value = el.options[0] ? el.options[0].value : '';
            } else if (el.type === 'file') {
                el.value = '';
            } else {
                el.value = '';
            }
        }
    });
}

async function saveEmployee() {
    if (currentEmployeeId) {
        await updateEmployee();
        return;
    }
    try {
        const payload = {
            employee_code: document.getElementById('emp_code').value.trim(),
            first_name: document.getElementById('emp_first_name').value.trim(),
            last_name: document.getElementById('emp_last_name').value.trim(),
            email: document.getElementById('emp_email').value.trim(),
            phone: document.getElementById('emp_phone').value.trim(),
            dob: document.getElementById('emp_dob').value,
            gender: document.getElementById('emp_gender').value,
            department_id: document.getElementById('emp_department').value || null,
            designation_id: document.getElementById('emp_designation').value || null,
            office_id: document.getElementById('emp_office').value || null,
            manager_id: document.getElementById('emp_manager').value || null,
            joining_date: document.getElementById('emp_joining_date').value,
            ctc: document.getElementById('emp_ctc').value,
            status: document.getElementById('emp_status').value,
            address: document.getElementById('emp_address').value.trim()
        };
        await fetchJson('/api/employees', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        showMessage('Employee saved successfully.', 'success');
        await loadLookups();
        clearEmployeeForm();
    } catch (err) {
        showMessage(err.message, 'error');
    }
}

async function updateEmployee() {
    if (!currentEmployeeId) {
        showMessage('Select an employee to update.', 'error');
        return;
    }
    try {
        const payload = {
            employee_code: document.getElementById('emp_code').value.trim(),
            first_name: document.getElementById('emp_first_name').value.trim(),
            last_name: document.getElementById('emp_last_name').value.trim(),
            email: document.getElementById('emp_email').value.trim(),
            phone: document.getElementById('emp_phone').value.trim(),
            dob: document.getElementById('emp_dob').value,
            gender: document.getElementById('emp_gender').value,
            department_id: document.getElementById('emp_department').value || null,
            designation_id: document.getElementById('emp_designation').value || null,
            office_id: document.getElementById('emp_office').value || null,
            manager_id: document.getElementById('emp_manager').value || null,
            joining_date: document.getElementById('emp_joining_date').value,
            ctc: document.getElementById('emp_ctc').value,
            status: document.getElementById('emp_status').value,
            address: document.getElementById('emp_address').value.trim()
        };
        await fetchJson(`/api/employees/${currentEmployeeId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        showMessage('Employee updated successfully.', 'success');
        await loadLookups();
        clearEmployeeForm();
    } catch (err) {
        showMessage(err.message, 'error');
    }
}

async function deleteEmployee() {
    if (!currentEmployeeId) {
        showMessage('Select an employee to delete.', 'error');
        return;
    }
    if (!confirm('Delete this employee?')) return;
    try {
        await fetchJson(`/api/employees/${currentEmployeeId}`, { method: 'DELETE' });
        showMessage('Employee deleted.', 'success');
        await loadLookups();
        clearEmployeeForm();
    } catch (err) {
        showMessage(err.message, 'error');
    }
}

function showEmployeeActionMenu(event, emp) {
    event.stopPropagation();
    let menu = getEl('employeeActionMenu');
    if (!menu) {
        // Create dynamically if missing in HTML (for robustness)
        menu = document.createElement('div');
        menu.id = 'employeeActionMenu';
        menu.className = 'employee-action-menu hidden';
        document.body.appendChild(menu);
    }
    // Ensure menu is direct child of body for reliable fixed positioning (avoids ancestor clipping, z, overflow issues)
    if (menu.parentElement !== document.body) {
        document.body.appendChild(menu);
    }
    menu.innerHTML = '';

    const title = document.createElement('div');
    title.textContent = `${emp.employee_code || ''} — ${emp.first_name || ''} ${emp.last_name || ''}`;
    menu.appendChild(title);

    const editBtn = document.createElement('button');
    editBtn.textContent = '✏️ Edit / Update Employee';
    editBtn.addEventListener('click', () => {
        closeEmployeeActionMenu();
        loadEmployee(emp);
        switchSubPage('employees', 'employee-detail');
    });
    menu.appendChild(editBtn);

    const delBtn = document.createElement('button');
    delBtn.textContent = '🗑️ Delete Employee';
    delBtn.style.color = '#ff6b6b';
    delBtn.addEventListener('click', async () => {
        closeEmployeeActionMenu();
        if (!confirm(`Delete employee ${emp.employee_code || ''} — ${emp.first_name || ''} ${emp.last_name || ''}?`)) return;
        try {
            currentEmployeeId = emp.id;
            await fetchJson(`/api/employees/${currentEmployeeId}`, { method: 'DELETE' });
            showMessage('Employee deleted.', 'success');
            await loadLookups();
            clearEmployeeForm();
        } catch (err) {
            showMessage(err.message, 'error');
        }
    });
    menu.appendChild(delBtn);

    // Position exactly where the cursor clicked (with small offset so it doesn't cover the pointer)
    // Using fixed positioning + client coords (viewport relative)
    menu.style.top = `${event.clientY + 8}px`;
    menu.style.left = `${event.clientX + 4}px`;
    menu.classList.remove('hidden');
}

function closeEmployeeActionMenu() {
    const menu = getEl('employeeActionMenu');
    if (menu) {
        menu.classList.add('hidden');
    }
}

async function saveDepartment() {
    try {
        const payload = {
            name: document.getElementById('dept_name').value.trim(),
            description: document.getElementById('dept_description').value.trim()
        };
        await fetchJson('/api/departments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        showMessage('Department added.', 'success');
        document.getElementById('dept_name').value = '';
        document.getElementById('dept_description').value = '';
        await loadLookups();
    } catch (err) {
        showMessage(err.message, 'error');
    }
}

async function deleteDepartment(id) {
    try {
        await fetchJson(`/api/departments/${id}`, { method: 'DELETE' });
        showMessage('Department removed.', 'success');
        await loadLookups();
    } catch (err) {
        showMessage(err.message, 'error');
    }
}

async function saveDesignation() {
    try {
        const payload = { title: document.getElementById('designation_title').value.trim(), department_id: document.getElementById('designation_department').value || null };
        await fetchJson('/api/designations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        showMessage('Designation added.', 'success');
        document.getElementById('designation_title').value = '';
        await loadLookups();
    } catch (err) {
        showMessage(err.message, 'error');
    }
}

async function deleteDesignation(id) {
    try {
        await fetchJson(`/api/designations/${id}`, { method: 'DELETE' });
        showMessage('Designation removed.', 'success');
        await loadLookups();
    } catch (err) {
        showMessage(err.message, 'error');
    }
}

async function saveOffice() {
    try {
        const payload = { name: document.getElementById('office_name').value.trim(), location: document.getElementById('office_location').value.trim() };
        await fetchJson('/api/offices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        showMessage('Office added.', 'success');
        document.getElementById('office_name').value = '';
        document.getElementById('office_location').value = '';
        await loadLookups();
    } catch (err) {
        showMessage(err.message, 'error');
    }
}

async function deleteOffice(id) {
    try {
        await fetchJson(`/api/offices/${id}`, { method: 'DELETE' });
        showMessage('Office removed.', 'success');
        await loadLookups();
    } catch (err) {
        showMessage(err.message, 'error');
    }
}

async function saveShift() {
    try {
        const payload = { name: document.getElementById('shift_name').value.trim(), start_time: document.getElementById('shift_start').value, end_time: document.getElementById('shift_end').value, description: document.getElementById('shift_description').value.trim() };
        await fetchJson('/api/shifts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        showMessage('Shift added.', 'success');
        document.getElementById('shift_name').value = '';
        document.getElementById('shift_start').value = '';
        document.getElementById('shift_end').value = '';
        document.getElementById('shift_description').value = '';
        await loadLookups();
    } catch (err) {
        showMessage(err.message, 'error');
    }
}

async function deleteShift(id) {
    try {
        await fetchJson(`/api/shifts/${id}`, { method: 'DELETE' });
        showMessage('Shift removed.', 'success');
        await loadLookups();
    } catch (err) {
        showMessage(err.message, 'error');
    }
}

let currentAttendanceEmployee = null;

async function loadAttendance() {
    try {
        const params = new URLSearchParams();
        let employeeId = getEl('attendance_filter_employee')?.value;
        // For regular employees, always force to only their own attendance
        if (currentUser && currentUser.employee_id && currentUser.is_admin !== true) {
            employeeId = currentUser.employee_id;
        }
        const startDate = getEl('attendance_filter_start')?.value;
        const endDate = getEl('attendance_filter_end')?.value;
        if (employeeId) params.append('employee_id', employeeId);
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);

        const summary = await fetchJson(`/api/attendance/summary?${params.toString()}`);
        const table = document.querySelector('#attendanceSummaryTable');
        const theadRow = table.querySelector('thead tr');
        theadRow.innerHTML = '<th>Employee</th><th>P</th><th>A</th><th>WO</th><th>Hol</th><th>H</th><th>Total</th>';
        summary.headers.forEach(header => {
            const th = document.createElement('th');
            th.textContent = header;
            theadRow.appendChild(th);
        });

        const tbody = table.querySelector('tbody');
        tbody.innerHTML = '';

        summary.rows.forEach(item => {
            const row = document.createElement('tr');
            let rowHtml = `
                <td class="attendance-employee-name">${item.employee_name}</td>
                <td>${item.present}</td>
                <td>${item.absent}</td>
                <td>${item.week_off}</td>
                <td>${item.holiday}</td>
                <td>${item.half_day}</td>
                <td>${item.total}</td>
            `;
            item.daily.forEach(day => {
                const badge = day.status ? `<span class="status-badge ${day.status}">${day.status}</span>` : '';
                rowHtml += `<td class="attendance-status-cell" data-attendance-id="${day.attendance_id || ''}" data-employee-id="${item.id}" data-date="${day.date}" data-status="${day.status || ''}">${badge}</td>`;
            });
            row.innerHTML = rowHtml;

            row.querySelector('.attendance-employee-name').addEventListener('click', () => showAttendanceDetailView(item.id, item.employee_name));
            row.querySelectorAll('.attendance-status-cell').forEach(cell => {
                cell.addEventListener('click', event => openAttendanceStatusMenu(event, {
                    id: cell.dataset.attendanceId,
                    employee_id: cell.dataset.employeeId,
                    employee_name: item.employee_name,
                    date: cell.dataset.date,
                    status: cell.dataset.status
                }));
            });
            tbody.appendChild(row);
        });
    } catch (err) {
        showMessage('Failed to load attendance summary.', 'error');
    }
}

async function showAttendanceDetailView(employeeId, employeeName) {
    currentAttendanceEmployee = employeeId;
    getEl('attendanceSummaryView').classList.add('hidden');
    getEl('attendanceDetailView').classList.remove('hidden');
    getEl('attendanceDetailTitle').textContent = `${employeeName} — Attendance Details`;
    const startDate = getEl('attendance_filter_start')?.value;
    const endDate = getEl('attendance_filter_end')?.value;
    getEl('attendanceDetailRange').textContent = `${startDate || 'All'} → ${endDate || 'All'}`;
    await loadAttendanceDetailRecords(employeeId);
}

function closeAttendanceDetailView() {
    getEl('attendanceDetailView').classList.add('hidden');
    getEl('attendanceSummaryView').classList.remove('hidden');
    currentAttendanceEmployee = null;
}

function showAttendanceActionsView() {
    getEl('attendanceFilterPanel')?.classList.add('hidden');
    getEl('attendanceSummaryView').classList.add('hidden');
    getEl('attendanceDetailView').classList.add('hidden');
    getEl('attendanceActionsView').classList.remove('hidden');
}

function closeAttendanceActionsView() {
    getEl('attendanceActionsView').classList.add('hidden');
    getEl('attendanceDetailView').classList.add('hidden');
    getEl('attendanceFilterPanel')?.classList.remove('hidden');
    getEl('attendanceSummaryView').classList.remove('hidden');
}

async function loadAttendanceDetailRecords(employeeId) {
    try {
        const params = new URLSearchParams();
        const startDate = getEl('attendance_filter_start')?.value;
        const endDate = getEl('attendance_filter_end')?.value;
        params.append('employee_id', employeeId);
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);

        const records = await fetchJson(`/api/attendance?${params.toString()}`);
        const tbody = document.querySelector('#attendanceDetailTable tbody');
        tbody.innerHTML = '';

        // Group records by date
        const grouped = {};
        records.forEach(record => {
            if (!grouped[record.date]) {
                grouped[record.date] = [];
            }
            grouped[record.date].push(record);
        });

        const counts = { present: 0, absent: 0, week_off: 0, holiday: 0, half_day: 0 };
        Object.keys(grouped).sort().forEach(date => {
            const dayRecords = grouped[date];
            // Combine data
            let status = '';
            let shift_name = '';
            let check_in = null;
            let check_out = null;
            let attendance_id = '';
            dayRecords.forEach(record => {
                if (record.status) status = record.status; // Take the last status
                if (record.shift_name) shift_name = record.shift_name;
                if (record.check_in && (!check_in || record.check_in < check_in)) check_in = record.check_in;
                if (record.check_out && (!check_out || record.check_out > check_out)) check_out = record.check_out;
                attendance_id = record.id; // Take the last id for edit
            });
            counts.present += status === 'P' ? 1 : 0;
            counts.absent += status === 'A' ? 1 : 0;
            counts.week_off += status === 'WO' ? 1 : 0;
            counts.holiday += status === 'H' ? 1 : 0;
            counts.half_day += (status === 'AH' || status === 'HF') ? 1 : 0;
            const row = document.createElement('tr');
            const hasRecordId = Boolean(attendance_id);
            row.innerHTML = `
                <td>${formatAttendanceDate(date)}</td>
                <td><span class="status-badge ${status}">${status}</span></td>
                <td>${shift_name || ''}</td>
                <td>${check_in || '-'}</td>
                <td>${check_out || '-'}</td>
                <td>${calculateWorkingHours(check_in, check_out)}</td>
                <td>${hasRecordId ? `<button class="btn btn-secondary small" data-attendance-id="${attendance_id}">Edit</button>` : ''}</td>
            `;
            if (hasRecordId) {
                row.querySelector('button').addEventListener('click', () => {
                    // Find the record with check_out or the last one
                    const editRecord = dayRecords.find(r => r.check_out) || dayRecords[dayRecords.length - 1];
                    openAttendanceEdit(editRecord);
                });
            }
            tbody.appendChild(row);
        });

        getEl('detailPresentCount').textContent = counts.present;
        getEl('detailAbsentCount').textContent = counts.absent;
        getEl('detailWoCount').textContent = counts.week_off;
        getEl('detailHolidayCount').textContent = counts.holiday;
        getEl('detailHalfDayCount').textContent = counts.half_day;
    } catch (err) {
        showMessage('Failed to load attendance details.', 'error');
    }
}

function openAttendanceStatusMenu(event, record) {
    event.stopPropagation();
    const menu = getEl('attendanceStatusMenu');
    if (!menu) return;
    menu.innerHTML = '';
    const statuses = [
        { label: 'Present (P)', value: 'P' },
        { label: 'Absent (A)', value: 'A' },
        { label: 'Weekly Off (WO)', value: 'WO' },
        { label: 'Holiday (H)', value: 'H' },
        { label: 'Half Day (AH)', value: 'AH' }
    ];
    statuses.forEach(item => {
        const button = document.createElement('button');
        button.textContent = item.label;
        button.addEventListener('click', async () => {
            if (!record.id) return;
            await updateAttendanceStatus(record.id, item.value);
            closeAttendanceStatusMenu();
        });
        menu.appendChild(button);
    });
    const more = document.createElement('button');
    more.textContent = 'More Options →';
    more.addEventListener('click', () => {
        closeAttendanceStatusMenu();
        if (record.id) {
            openAttendanceEdit(record);
        }
    });
    menu.appendChild(more);
    const rect = event.target.getBoundingClientRect();
    menu.style.top = `${rect.bottom + window.scrollY + 8}px`;
    menu.style.left = `${rect.left + window.scrollX}px`;
    menu.classList.remove('hidden');
}

function closeAttendanceStatusMenu() {
    const menu = getEl('attendanceStatusMenu');
    if (menu) {
        menu.classList.add('hidden');
    }
}

async function updateAttendanceStatus(attendanceId, status) {
    try {
        await fetchJson(`/api/attendance/${attendanceId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
        showMessage('Attendance status updated.', 'success');
        await loadAttendance();
        if (currentAttendanceEmployee) {
            await loadAttendanceDetailRecords(currentAttendanceEmployee);
        }
    } catch (err) {
        showMessage(err.message, 'error');
    }
}

function formatAttendanceDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

function calculateWorkingHours(start, end) {
    if (!start || !end) return '-';
    const startDate = new Date(`1970-01-01T${start}:00`);
    const endDate = new Date(`1970-01-01T${end}:00`);
    if (endDate <= startDate) {
        endDate.setDate(endDate.getDate() + 1);
    }
    const diff = endDate - startDate;
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

function clearAttendanceForm() {
    const fields = ['attendance_employee', 'attendance_date', 'attendance_status', 'attendance_shift', 'attendance_check_in', 'attendance_check_out'];
    fields.forEach(id => {
        const el = getEl(id);
        if (el) {
            if (el.tagName === 'SELECT') {
                el.selectedIndex = 0;
            } else {
                el.value = '';
            }
        }
    });
    const today = new Date().toISOString().slice(0, 10);
    const attendanceDate = getEl('attendance_date');
    if (attendanceDate) attendanceDate.value = today;
}

function clearAttendanceFilters() {
    const filterEmployee = getEl('attendance_filter_employee');
    const filterStart = getEl('attendance_filter_start');
    const filterEnd = getEl('attendance_filter_end');
    if (filterEmployee) {
        if (currentUser && currentUser.employee_id && currentUser.is_admin !== true) {
            filterEmployee.value = currentUser.employee_id;
        } else {
            filterEmployee.value = '';
        }
    }
    if (filterStart) filterStart.value = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    if (filterEnd) filterEnd.value = new Date().toISOString().slice(0, 10);
    loadAttendance();
}

function openAttendanceEdit(record) {
    const popup = getEl('attendanceEditPopup');
    if (!popup) return;
    getEl('edit_attendance_status').value = record.status || 'P';
    getEl('edit_attendance_check_in').value = record.check_in || '';
    getEl('edit_attendance_check_out').value = record.check_out || '';
    populateShiftSelect(getEl('edit_attendance_shift'));
    if (record.shift_id) {
        getEl('edit_attendance_shift').value = record.shift_id;
    }
    popup.dataset.attendanceId = record.id;
    popup.classList.remove('hidden');
}

function closeAttendanceEdit() {
    const popup = getEl('attendanceEditPopup');
    if (popup) {
        popup.classList.add('hidden');
        delete popup.dataset.attendanceId;
    }
}

async function updateAttendanceRecord() {
    try {
        const popup = getEl('attendanceEditPopup');
        if (!popup || !popup.dataset.attendanceId) return;
        const attendanceId = popup.dataset.attendanceId;
        const payload = {
            status: getEl('edit_attendance_status').value,
            shift_id: getEl('edit_attendance_shift').value || null,
            check_in: getEl('edit_attendance_check_in').value,
            check_out: getEl('edit_attendance_check_out').value
        };
        await fetchJson(`/api/attendance/${attendanceId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        showMessage('Attendance updated successfully.', 'success');
        closeAttendanceEdit();
        await loadAttendance();
        if (currentAttendanceEmployee) {
            await loadAttendanceDetailRecords(currentAttendanceEmployee);
        }
    } catch (err) {
        showMessage(err.message, 'error');
    }
}

async function importAttendance() {
    const fileInput = getEl('attendanceImportFile');
    const statusDiv = getEl('attendanceImportStatus');
    if (!fileInput || !fileInput.files.length) {
        if (statusDiv) {
            statusDiv.textContent = 'Please select an attendance Excel file.';
            statusDiv.style.color = 'red';
        }
        return;
    }
    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('file', file);
    try {
        if (statusDiv) {
            statusDiv.textContent = 'Uploading attendance file...';
            statusDiv.style.color = 'blue';
        }
        const response = await fetch('/api/attendance/bulk-import', { method: 'POST', body: formData });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || 'Bulk import failed');
        }
        if (statusDiv) {
            statusDiv.innerHTML = `Imported <strong>${result.imported}</strong> attendance records.`;
            statusDiv.style.color = 'green';
        }
        fileInput.value = '';
        // Switch back to summary view and reload with cleared filters
        closeAttendanceActionsView();
        clearAttendanceFilters();
    } catch (err) {
        if (statusDiv) {
            statusDiv.textContent = err.message;
            statusDiv.style.color = 'red';
        }
    }
}

function showAllAttendanceMarkView() {
    getEl('attendanceFilterPanel')?.classList.add('hidden');
    getEl('attendanceSummaryView')?.classList.add('hidden');
    getEl('attendanceActionsView')?.classList.add('hidden');
    getEl('attendanceDetailView')?.classList.add('hidden');
    getEl('allAttendanceMarkView')?.classList.remove('hidden');
    const dateInput = getEl('all_mark_date');
    if (dateInput && !dateInput.value) {
        const today = new Date().toISOString().slice(0, 10);
        dateInput.value = today;
    }
    const container = getEl('allMarkEmployeesContainer');
    if (container) container.innerHTML = '<p style="padding:12px; color:#888;">Loading employees for selected date...</p>';
    // auto load for the (default) date
    setTimeout(() => loadAllMarkEmployees(), 0);
}

function closeAllAttendanceMarkView() {
    getEl('allAttendanceMarkView')?.classList.add('hidden');
    getEl('attendanceFilterPanel')?.classList.remove('hidden');
    getEl('attendanceSummaryView')?.classList.remove('hidden');
    loadAttendance();
}

async function loadAllMarkEmployees() {
    const dateInput = getEl('all_mark_date');
    const date = dateInput ? dateInput.value : '';
    const container = getEl('allMarkEmployeesContainer');
    if (!container) return;
    if (!date) {
        showMessage('Please select a date first.', 'error');
        return;
    }
    container.innerHTML = '<p style="padding:12px; color:#888;">Loading employees and current attendance...</p>';
    try {
        if (!state.employees || state.employees.length === 0) {
            await loadLookups();
        }
        const attResp = await fetchJson(`/api/attendance?start_date=${encodeURIComponent(date)}&end_date=${encodeURIComponent(date)}`);
        const attMap = {};
        (attResp || []).forEach(r => {
            if (r.employee_id != null) attMap[r.employee_id] = r;
        });
        let html = '<table style="width:100%; border-collapse: collapse; font-size:0.9rem;"><thead><tr>' +
            '<th style="text-align:left; padding:8px; border-bottom:1px solid #444; background:#222; position:sticky; top:0;">Employee</th>' +
            '<th style="padding:8px; border-bottom:1px solid #444; background:#222; width:210px; position:sticky; top:0;">Status (P / A / HF / H)</th>' +
            '<th style="text-align:left; padding:8px; border-bottom:1px solid #444; background:#222; position:sticky; top:0;">Remarks</th>' +
            '</tr></thead><tbody>';
        state.employees.forEach(emp => {
            const rec = attMap[emp.id] || {};
            const curStatus = rec.status || '';
            const curRemarks = (rec.remarks || '').replace(/"/g, '&quot;');
            const code = emp.employee_code ? (emp.employee_code + ' - ') : '';
            const name = `${emp.first_name || ''} ${emp.last_name || ''}`.trim();
            html += `<tr data-employee-id="${emp.id}" style="border-bottom:1px solid #333;">` +
                `<td style="padding:6px 8px;">${code}${name}</td>` +
                `<td style="padding:6px 8px;"><div class="status-selector" data-emp-id="${emp.id}">` +
                ['P','A','HF','H'].map(s => {
                    const active = (curStatus === s) ? ' active' : '';
                    return `<button type="button" class="status-pill ${s}${active}" data-status="${s}">${s}</button>`;
                }).join('') +
                `</div></td>` +
                `<td style="padding:6px 8px;"><input type="text" class="remarks-input" value="${curRemarks}" placeholder="Optional remarks" style="width:100%; padding:4px 6px; background:#111; color:#eee; border:1px solid #444; border-radius:4px;"></td>` +
                `</tr>`;
        });
        html += '</tbody></table>';
        container.innerHTML = html;

        // wire status pills (click active again to unselect)
        container.querySelectorAll('.status-selector').forEach(sel => {
            const pills = sel.querySelectorAll('.status-pill');
            pills.forEach(pill => {
                pill.addEventListener('click', () => {
                    const isActive = pill.classList.contains('active');
                    pills.forEach(p => p.classList.remove('active'));
                    if (isActive) {
                        delete sel.dataset.selectedStatus;
                    } else {
                        pill.classList.add('active');
                        sel.dataset.selectedStatus = pill.dataset.status;
                    }
                });
            });
            const activePill = sel.querySelector('.status-pill.active');
            if (activePill) sel.dataset.selectedStatus = activePill.dataset.status;
        });
    } catch (err) {
        container.innerHTML = `<p style="padding:12px; color:#e53935;">Failed to load: ${err.message || err}</p>`;
    }
}

function setAllStatuses(status) {
    const container = getEl('allMarkEmployeesContainer');
    if (!container) return;
    container.querySelectorAll('.status-selector').forEach(sel => {
        sel.querySelectorAll('.status-pill').forEach(p => p.classList.remove('active'));
        const target = sel.querySelector(`.status-pill[data-status="${status}"]`);
        if (target) {
            target.classList.add('active');
            sel.dataset.selectedStatus = status;
        }
    });
}

async function submitAllAttendance() {
    const dateInput = getEl('all_mark_date');
    const date = dateInput ? dateInput.value : '';
    const container = getEl('allMarkEmployeesContainer');
    if (!container || !date) {
        showMessage('Select a date and load employees first.', 'error');
        return;
    }
    const rows = container.querySelectorAll('tr[data-employee-id]');
    const records = [];
    rows.forEach(row => {
        const empId = parseInt(row.dataset.employeeId, 10);
        const sel = row.querySelector('.status-selector');
        const status = sel && sel.dataset.selectedStatus ? sel.dataset.selectedStatus : '';
        const remInp = row.querySelector('.remarks-input');
        const remarks = remInp ? remInp.value.trim() : '';
        if (status) {
            records.push({ employee_id: empId, status: status, remarks: remarks });
        }
    });
    if (records.length === 0) {
        showMessage('Please select a status for at least one employee.', 'error');
        return;
    }
    try {
        const result = await fetchJson('/api/attendance/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date, records })
        });
        showMessage(`Saved ${result.saved || records.length} attendance records for ${date}.`, 'success');
        // refresh the list with latest from server
        await loadAllMarkEmployees();
    } catch (err) {
        showMessage(err.message || 'Failed to submit all attendance.', 'error');
    }
}

function clearAllMarkList() {
    const container = getEl('allMarkEmployeesContainer');
    if (container) container.innerHTML = '<p style="padding:12px; color:#888;">List cleared. Load again to repopulate.</p>';
}

function populateShiftSelect(selectElement) {
    if (!selectElement) return;
    selectElement.innerHTML = '<option value="">-- None --</option>';
    state.shifts.forEach(shift => {
        const option = document.createElement('option');
        option.value = shift.id;
        option.textContent = `${shift.name} (${shift.start_time} - ${shift.end_time})`;
        selectElement.appendChild(option);
    });
}

async function saveAttendance() {
    try {
        const attendanceEmployee = document.getElementById('attendance_employee');
        const payload = {
            employee_id: attendanceEmployee ? attendanceEmployee.value : null,
            date: document.getElementById('attendance_date').value,
            status: document.getElementById('attendance_status').value,
            shift_id: document.getElementById('attendance_shift').value || null,
            check_in: document.getElementById('attendance_check_in').value,
            check_out: document.getElementById('attendance_check_out').value
        };
        await fetchJson('/api/attendance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        showMessage('Attendance saved.', 'success');
        clearAttendanceForm();
        await loadAttendance();
    } catch (err) {
        showMessage(err.message, 'error');
    }
}

async function loadLeaveBalances() {
    try {
        const balances = await fetchJson('/api/leave-balances');
        const tbody = document.querySelector('#leaveDashboardTable tbody');
        tbody.innerHTML = '';
        balances.forEach(item => {
            const total = item.earned_leave + item.casual_leave + item.loss_of_pay;
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.employee_name}</td>
                <td>${item.earned_leave}</td>
                <td>${item.casual_leave}</td>
                <td>${item.loss_of_pay}</td>
                <td>${total}</td>
            `;
            tbody.appendChild(row);
        });
    } catch (err) {
        showMessage('Failed to load leave balances.', 'error');
    }
}

async function loadLeaveRequests() {
    try {
        const leaves = await fetchJson('/api/leaves');
        const tbody = document.querySelector('#leaveRequestTable tbody');
        tbody.innerHTML = '';
        leaves.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.employee_name || ''}</td>
                <td>${item.leave_type}</td>
                <td>${item.start_date} → ${item.end_date}</td>
                <td>${item.status}</td>
                <td></td>
            `;
            if (item.status === 'Pending') {
                const approve = document.createElement('button');
                approve.className = 'btn btn-secondary small';
                approve.textContent = 'Approve';
                approve.addEventListener('click', () => updateLeaveStatus(item.id, 'Approved'));
                const reject = document.createElement('button');
                reject.className = 'btn btn-danger small';
                reject.textContent = 'Reject';
                reject.addEventListener('click', () => updateLeaveStatus(item.id, 'Rejected'));
                row.querySelector('td:last-child').appendChild(approve);
                row.querySelector('td:last-child').appendChild(reject);
            }
            tbody.appendChild(row);
        });
    } catch (err) {
        showMessage('Failed to load leave requests.', 'error');
    }
}

async function saveLeave() {
    try {
        const payload = { employee_id: document.getElementById('leave_employee').value, leave_type: document.getElementById('leave_type').value, start_date: document.getElementById('leave_start').value, end_date: document.getElementById('leave_end').value, reason: document.getElementById('leave_reason').value.trim() };
        await fetchJson('/api/leaves', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        showMessage('Leave request submitted.', 'success');
        document.getElementById('leave_reason').value = '';
        await loadLeaveRequests();
    } catch (err) {
        showMessage(err.message, 'error');
    }
}

async function updateLeaveStatus(id, status) {
    try {
        await fetchJson(`/api/leaves/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
        showMessage('Leave status updated.', 'success');
        await loadLeaveRequests();
    } catch (err) {
        showMessage(err.message, 'error');
    }
}

async function loadPayrolls() {
    try {
        const payrolls = await fetchJson('/api/payrolls');
        const tbody = document.querySelector('#payrollTable tbody');
        tbody.innerHTML = '';
        payrolls.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.employee_name || ''}</td>
                <td>${item.month}/${item.year}</td>
                <td>${item.gross.toFixed(2)}</td>
                <td>${item.total_deductions.toFixed(2)}</td>
                <td>${item.net_pay.toFixed(2)}</td>
            `;
            tbody.appendChild(row);
        });
    } catch (err) {
        showMessage('Failed to load payroll records.', 'error');
    }
}

async function loadStatutory() {
    try {
        const statutory = await fetchJson('/api/statutory');
        renderStatutoryTable(statutory);
    } catch (err) {
        showMessage('Failed to load statutory settings.', 'error');
    }
}

async function generatePayroll() {
    try {
        const payload = { employee_id: document.getElementById('payroll_employee').value, month: Number(document.getElementById('payroll_month').value), year: Number(document.getElementById('payroll_year').value) };
        const payroll = await fetchJson('/api/payrolls', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        showMessage('Payroll generated.', 'success');
        document.getElementById('payrollSummary').innerHTML = `
            <div class="payroll-card">
                <h3>${payroll.employee_name} — ${payroll.month}/${payroll.year}</h3>
                <div class="payroll-grid">
                    <div><strong>Basic</strong><span>${payroll.basic.toFixed(2)}</span></div>
                    <div><strong>DA</strong><span>${payroll.da.toFixed(2)}</span></div>
                    <div><strong>HRA</strong><span>${payroll.hra.toFixed(2)}</span></div>
                    <div><strong>Conveyance</strong><span>${payroll.conveyance.toFixed(2)}</span></div>
                    <div><strong>Special</strong><span>${payroll.special_allowance.toFixed(2)}</span></div>
                    <div><strong>Gross</strong><span>${payroll.gross.toFixed(2)}</span></div>
                    <div><strong>PF</strong><span>${payroll.pf.toFixed(2)}</span></div>
                    <div><strong>ESIC</strong><span>${payroll.esic.toFixed(2)}</span></div>
                    <div><strong>Prof. Tax</strong><span>${payroll.professional_tax.toFixed(2)}</span></div>
                    <div><strong>LWF</strong><span>${payroll.lwf.toFixed(2)}</span></div>
                    <div><strong>Total Deductions</strong><span>${payroll.total_deductions.toFixed(2)}</span></div>
                    <div><strong>Net Pay</strong><span>${payroll.net_pay.toFixed(2)}</span></div>
                </div>
            </div>
        `;
        await loadPayrolls();
    } catch (err) {
        showMessage(err.message, 'error');
    }
}

async function generateOfferLetter() {
    try {
        const payload = {
            offer_date: document.getElementById('offer_date').value,
            prefix: document.getElementById('prefix').value,
            name: document.getElementById('candidate_name').value.trim(),
            position: document.getElementById('position').value.trim(),
            joining_date: document.getElementById('joining_date').value,
            location: document.getElementById('location').value.trim(),
            department: document.getElementById('department').value.trim(),
            monthly_ctc: document.getElementById('monthly_ctc').value
        };
        const response = await fetch('/generate-offer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to generate offer letter.');
        }
        const blob = await response.blob();
        const filename = `Offer_Letter_${payload.name}_${payload.position}.docx`;
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        showMessage('Offer letter downloaded.', 'success');
    } catch (err) {
        showMessage(err.message, 'error');
    }
}

async function bulkImportEmployees() {
    const fileInput = document.getElementById('bulkImportFile');
    const statusDiv = document.getElementById('importStatus');
    
    if (!fileInput.files.length) {
        statusDiv.textContent = '❌ Please select a file first.';
        statusDiv.style.color = 'red';
        return;
    }
    
    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        statusDiv.textContent = 'Uploading and importing...';
        statusDiv.style.color = 'blue';
        
        const response = await fetch('/api/employees/bulk-import', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok) {
            const imported = result.imported || 0;
            const updated = result.updated || 0;
            const total = imported + updated;
            statusDiv.innerHTML = `✅ Successfully processed <strong>${total}</strong> employee(s)! (new: ${imported}, updated: ${updated})`;
            statusDiv.style.color = 'green';
            fileInput.value = '';
            setTimeout(async () => {
                try {
                    await loadLookups();
                } catch (e) {
                    // ignore refresh errors
                }
                statusDiv.textContent = '';
            }, 2000);
        } else {
            statusDiv.innerHTML = `❌ Error: ${result.error}`;
            statusDiv.style.color = 'red';
        }
    } catch (err) {
        statusDiv.innerHTML = `❌ Error: ${err.message}`;
        statusDiv.style.color = 'red';
    }
}

async function init() {
    setDefaultDates();
    try {
        const res = await fetch('/api/current_user');
        if (res.ok) {
            currentUser = await res.json();
        }
    } catch (e) {}
    applyUserRestrictions();  // hide restricted tabs early for employees
    await loadLookups();
    applyUserRestrictions();  // re-apply after data load in case
    // Load pending approvals in background
    loadPendingJoinings();
}

const bindClick = (id, handler) => {
    const element = document.getElementById(id);
    if (element) {
        element.addEventListener('click', handler);
    }
};

bindClick('saveEmployee', saveEmployee);
bindClick('clearEmployee', clearEmployeeForm);
bindClick('saveJoiningForm', saveJoiningForm);
bindClick('clearJoiningForm', clearJoiningForm);
bindClick('bulkImportBtn', bulkImportEmployees);
bindClick('saveDepartment', saveDepartment);
bindClick('saveDesignation', saveDesignation);
bindClick('saveOffice', saveOffice);
bindClick('saveShift', saveShift);
bindClick('saveAttendance', saveAttendance);
bindClick('clearAttendance', clearAttendanceForm);
bindClick('attendanceFilterBtn', loadAttendance);
bindClick('attendanceClearFilterBtn', clearAttendanceFilters);
bindClick('attendanceSingleMarkBtn', showAttendanceActionsView);
bindClick('attendanceImportBtn', importAttendance);
bindClick('attendanceActionsBack', closeAttendanceActionsView);
bindClick('saveAttendanceEdit', updateAttendanceRecord);
bindClick('closeAttendanceEdit', closeAttendanceEdit);
bindClick('attendanceDetailBack', closeAttendanceDetailView);
bindClick('saveLeave', saveLeave);
bindClick('generatePayroll', generatePayroll);
bindClick('generateOffer', generateOfferLetter);

bindClick('allEmployeeAttendanceMarkBtn', showAllAttendanceMarkView);
bindClick('allMarkBackBtn', closeAllAttendanceMarkView);
bindClick('loadAllEmployeesBtn', loadAllMarkEmployees);
bindClick('submitAllAttendanceBtn', submitAllAttendance);
bindClick('clearAllMarkBtn', clearAllMarkList);

// Wire quick-set buttons for All Employee Attendance Mark (data-quick)
document.querySelectorAll('#allAttendanceMarkView [data-quick]').forEach(btn => {
    btn.addEventListener('click', () => setAllStatuses(btn.dataset.quick));
});

// Auto-load employees list when date changes in the All Mark view
const allMarkDateEl = document.getElementById('all_mark_date');
if (allMarkDateEl) {
    allMarkDateEl.addEventListener('change', () => {
        const container = document.getElementById('allMarkEmployeesContainer');
        if (container) {
            loadAllMarkEmployees();
        }
    });
}

const bindInput = (id, handler) => {
    const element = document.getElementById(id);
    if (element) {
        element.addEventListener('input', handler);
    }
};

bindInput('monthly_ctc', updateLetterAmounts);

// Close pop-up menus on outside click (employee actions + attendance status)
document.addEventListener('click', event => {
    // If click was on an employee code cell, don't auto-close (the show handler will manage)
    if (event.target.closest('.employee-code-cell')) {
        return;
    }
    const attMenu = getEl('attendanceStatusMenu');
    if (attMenu && !attMenu.classList.contains('hidden') && !attMenu.contains(event.target)) {
        if (typeof closeAttendanceStatusMenu === 'function') closeAttendanceStatusMenu();
    }
    const empMenu = getEl('employeeActionMenu');
    if (empMenu && !empMenu.classList.contains('hidden') && !empMenu.contains(event.target)) {
        if (typeof closeEmployeeActionMenu === 'function') closeEmployeeActionMenu();
    }
});

document.addEventListener('DOMContentLoaded', init);

// ==================== APPROVALS SECTION ====================
async function loadPendingJoinings() {
    try {
        const joinings = await fetchJson('/api/pending-joinings');
        renderPendingJoiningsTable(joinings);
    } catch (err) {
        console.error('Failed to load pending joinings:', err);
    }
}

function renderPendingJoiningsTable(joinings) {
    const tbody = document.querySelector('#pendingJoiningsTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (!joinings || joinings.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="6" style="text-align:center; color:#888;">No pending approvals</td>`;
        tbody.appendChild(tr);
        return;
    }
    
    joinings.forEach(j => {
        const tr = document.createElement('tr');
        const submitted = j.submitted_on ? new Date(j.submitted_on).toLocaleDateString() : '-';
        tr.innerHTML = `
            <td>${submitted}</td>
            <td>${j.full_name || ''}</td>
            <td>${j.email_id || ''}</td>
            <td><strong>${j.employee_code || ''}</strong></td>
            <td>${j.designation || ''}</td>
            <td>
                <button class="btn btn-primary small" data-id="${j.id}">Approve</button>
                <button class="btn btn-danger small" data-id="${j.id}">Reject</button>
            </td>
        `;
        
        // Approve
        tr.querySelector('button.btn-primary').addEventListener('click', async () => {
            if (!confirm(`Approve ${j.full_name} and add to Employees?`)) return;
            try {
                await fetchJson('/api/approve-joining', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ id: j.id })
                });
                showMessage('Employee approved and added to the list!', 'success');
                await loadPendingJoinings();
                await loadLookups(); // refresh main employees list
            } catch (e) {
                showMessage(e.message, 'error');
            }
        });
        
        // Reject
        tr.querySelector('button.btn-danger').addEventListener('click', async () => {
            if (!confirm(`Reject ${j.full_name}?`)) return;
            try {
                await fetchJson('/api/reject-joining', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ id: j.id })
                });
                showMessage('Joining rejected.', 'success');
                await loadPendingJoinings();
            } catch (e) {
                showMessage(e.message, 'error');
            }
        });
        
        tbody.appendChild(tr);
    });
}

// Load pending when approvals tab is clicked
document.querySelectorAll('.tab[data-tab="approvals"]').forEach(tab => {
    tab.addEventListener('click', () => {
        setTimeout(loadPendingJoinings, 300); // small delay for tab to be visible
    });
});

// Also try to load once on full init (in case Approvals is the active tab)
setTimeout(() => {
    const approvalsTab = document.querySelector('.tab[data-tab="approvals"]');
    if (approvalsTab && approvalsTab.classList.contains('active')) {
        loadPendingJoinings();
    }
}, 1500);

function applyUserRestrictions() {
    const userInfo = document.getElementById('user-info');
    const loggedUser = document.getElementById('logged-user');

    if (userInfo) {
        userInfo.style.display = 'flex';  // always show on main app since only rendered when logged in
    }

    const isAdmin = currentUser && currentUser.is_admin === true;

    if (isAdmin) {
        if (loggedUser) loggedUser.textContent = 'Admin';
        return;
    }

    // If here: either not logged (shouldn't happen on index) or regular employee --> hide restricted tabs
    // Hide main tabs
    const tabsToHide = ['payroll', 'settings', 'letter-generator', 'joining-form', 'approvals'];
    tabsToHide.forEach(tabName => {
        const tab = document.querySelector(`.tab[data-tab="${tabName}"]`);
        if (tab) tab.style.display = 'none';
    });

    // Hide Shift and Leave sub menus in Employees dropdown for regular employees
    const shiftLi = document.querySelector('.dropdown-menu li[data-sub="shift"]');
    if (shiftLi) shiftLi.style.display = 'none';

    const leaveLi = document.querySelector('.dropdown-menu li[data-sub="leave"]');
    if (leaveLi) leaveLi.style.display = 'none';

    // Hide Add Employee if present in dropdown (since joining is separate)
    const addEmpLi = document.querySelector('.dropdown-menu li[data-sub="employee-detail"]');
    if (addEmpLi) addEmpLi.style.display = 'none';

    // Hide "Mark & Import Attendance" and "All Employee Attendance Mark" buttons for regular employees
    const markImportBtn = getEl('attendanceSingleMarkBtn');
    if (markImportBtn) markImportBtn.style.display = 'none';

    const allMarkBtn = getEl('allEmployeeAttendanceMarkBtn');
    if (allMarkBtn) allMarkBtn.style.display = 'none';

    // Show user info for logged employee (or generic if currentUser not fully loaded)
    if (loggedUser) {
        loggedUser.textContent = (currentUser && currentUser.name) || currentUser.phone || 'Employee';
    }
}

function logoutUser() {
    window.location.href = '/logout';
}

// Delegated click handler for employee code cells (robust, survives re-renders)
function attachEmployeeCodeClickHandler() {
    const empTableBody = document.querySelector('#employeesTable tbody');
    if (empTableBody && !empTableBody._employeeCodeClickAttached) {
        empTableBody._employeeCodeClickAttached = true;
        empTableBody.addEventListener('click', (e) => {
            const codeCell = e.target.closest('.employee-code-cell');
            if (codeCell) {
                const empId = parseInt(codeCell.dataset.employeeId, 10);
                const emp = state.employees.find(e => e.id === empId);
                if (emp) {
                    showEmployeeActionMenu(e, emp);
                }
            }
        });
    }
}

// Attach after DOM ready and also after table renders (e.g. after loadLookups)
document.addEventListener('DOMContentLoaded', attachEmployeeCodeClickHandler);
 // Also call directly in case already loaded (script at bottom)
attachEmployeeCodeClickHandler();

// Attach employee table header sorting (thead is static, delegation safe across re-renders)
const empSortTable = document.getElementById('employeesTable');
if (empSortTable) {
    const sortThead = empSortTable.querySelector('thead');
    if (sortThead) {
        sortThead.addEventListener('click', (e) => {
            const th = e.target.closest('th[data-col]');
            if (th) {
                sortEmployeesBy(th.dataset.col);
            }
        });
    }
}

// Employee records search + filters (search by name/code, filter by dept/desig/office/manager)
function attachEmployeeFilters() {
    const table = document.getElementById('employeesTable');
    if (table && table._empFiltersAttached) return;
    if (table) table._empFiltersAttached = true;

    const search = getEl('empSearch');
    if (search) {
        search.addEventListener('input', renderFilteredEmployees);
    }
    ['filterDept', 'filterDesig', 'filterOffice', 'filterManager'].forEach(id => {
        const sel = getEl(id);
        if (sel) {
            sel.addEventListener('change', renderFilteredEmployees);
        }
    });
    const clearBtn = getEl('clearEmpFilters');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            const s = getEl('empSearch'); if (s) s.value = '';
            ['filterDept', 'filterDesig', 'filterOffice', 'filterManager'].forEach(id => {
                const e = getEl(id); if (e) e.value = '';
            });
            renderFilteredEmployees();
        });
    }
}

document.addEventListener('DOMContentLoaded', attachEmployeeFilters);
attachEmployeeFilters();
