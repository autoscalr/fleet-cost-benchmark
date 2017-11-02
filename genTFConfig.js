'use strict';

var Promise = require('bluebird')
var fs = require("fs");
var fsp = Promise.promisifyAll(fs)
var targVcpu = 1
var targVcpuEnv = process.env['ASR_TARG_VCPU']
if (targVcpuEnv && targVcpuEnv > 0) {
    targVcpu = targVcpuEnv
}
var testAMI = process.env['ASR_TEST_AMI']
var instTypeStr = process.env['ASR_INST_TYPES']
var instTypes = instTypeStr.split(',')
if (! instTypes || instTypes.length < 1) {
    // use deftaul
    instTypes = ['m4.large']
}

var fCont = ' provider "aws" { \n'
fCont += '     region = "us-east-1" \n'
fCont += ' } \n'
fCont += ' provider "autoscalr" { \n'
fCont += ' } \n'
fCont += ' resource "aws_launch_configuration" "test_lc" { \n'
fCont += '     name_prefix   = "test-lc-" \n'
fCont += '     image_id      = "' + testAMI + '" \n'
fCont += '     instance_type = "m3.medium" \n'
fCont += '     lifecycle { \n'
fCont += '         create_before_destroy = true \n'
fCont += '     } \n'
fCont += ' } \n'
fCont += ' resource "aws_autoscaling_group" "autoscalr_test_ASG" { \n'
fCont += '     availability_zones = ["us-east-1a", "us-east-1b","us-east-1c"] \n'
fCont += '     name_prefix   = "test-asg-" \n'
fCont += '     max_size = 10 \n'
fCont += '     min_size = 0 \n'
fCont += '     health_check_grace_period = 300 \n'
fCont += '     health_check_type = "EC2" \n'
fCont += '     force_delete = true \n'
fCont += '     launch_configuration = "${aws_launch_configuration.test_lc.name}" \n'
fCont += '     lifecycle { \n'
fCont += '         create_before_destroy = true \n'
fCont += '     } \n'
fCont += '     suspended_processes = ["AZRebalance"] \n'
fCont += ' } \n'
fCont += ' resource "autoscalr_autoscaling_group" "asr4MyExampleASG" { \n'
fCont += '     aws_region = "us-east-1" \n'
fCont += '     aws_autoscaling_group_name = "${aws_autoscaling_group.autoscalr_test_ASG.name}" \n'
fCont += '     display_name = "Fleet Benchmark" \n'
fCont += '     scale_mode = "fixed" \n'
fCont += '     target_capacity = 1 \n'
fCont += '     instance_types = '+ JSON.stringify(instTypes) + ' \n'
fCont += '     max_spot_percent_total = 100 \n'
fCont += '     max_spot_percent_one_market = 100 \n'
fCont += ' } \n'
fCont += '   \n'
fCont += ' resource "aws_iam_role" "fleet" { \n'
fCont += '     assume_role_policy = "{ \\"Version\\": \\"2008-10-17\\", \\"Statement\\": [ { \\"Sid\\": \\"\\",\\"Effect\\": \\"Allow\\",\\"Principal\\": {\\"Service\\": [ \\"spotfleet.amazonaws.com\\",\\"ec2.amazonaws.com\\" ] },\\"Action\\": \\"sts:AssumeRole\\"}]}"\n'
fCont += ' } \n'
fCont += ' resource "aws_iam_policy_attachment" "fleet" { \n'
fCont += '     name       = "policy_for_${aws_iam_role.fleet.name}" \n'
fCont += '     roles      = ["${aws_iam_role.fleet.name}"] \n'
fCont += '     policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEC2SpotFleetTaggingRole" \n'
fCont += ' } \n'
fCont += ' resource "aws_spot_fleet_request" "spotFleet" { \n'
fCont += '     iam_fleet_role      = "${aws_iam_role.fleet.arn}" \n'
fCont += '     spot_price          = "0.3" \n'
fCont += '     allocation_strategy = "diversified" \n'
fCont += '     target_capacity     = 1 \n'
fCont += '     valid_until         = "2019-11-04T20:44:20Z" \n'
fCont += '     terminate_instances_with_expiration = true \n'
// create a launch specification for each instance type
instTypes.forEach(function(iType) {
    fCont += '     launch_specification { \n'
    fCont += '         instance_type     = ' + iType + ' \n'
    fCont += '         ami               = "' + testAMI + '" \n'
    fCont += '         spot_price        = "0.25" \n'
    fCont += '         weighted_capacity = 1 \n'
    fCont += '         tags              = { \n'
    fCont += '             FleetManager = "SpotFleet" \n'
    fCont += '         } \n'
    fCont += '     } \n'
})
fCont += ' } \n'

fsp.writeFileAsync('./terraform/main.tf', fCont)
    .then(function(d) {
        console.log('Terraform file generated')
    })

