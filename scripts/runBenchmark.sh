#!/usr/bin/env bash
# load the AutoScalr Terraform plugin
git clone https://github.com/autoscalr/terraform-provider-autoscalr.git
git clone https://github.com/concurrencylabs/aws-cost-analysis.git
sudo pip install -r aws-cost-analysis/requirements.txt
